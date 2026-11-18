mod auth;
mod hub;

use axum::{
    body::Bytes,
    extract::{ws::{rejection::WebSocketUpgradeRejection, Message, WebSocket, WebSocketUpgrade}, DefaultBodyLimit, Path, Query, State},
    http::{HeaderMap, StatusCode, Uri},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use md5::{Digest, Md5};
use serde_json::{json, Value};
use std::{collections::HashMap, net::SocketAddr, sync::{Arc, Mutex}, time::Duration};
use tokio::sync::mpsc;

use hub::{Frame, Hub};

struct Stats {
    ok: std::sync::atomic::AtomicU64,
    rejected: std::sync::atomic::AtomicU64,
    last_reject: Mutex<String>,
}

struct App {
    stats: Stats,
    hub: Mutex<Hub>,
    pusher_key: String,
    pusher_secret: String,
    join_key: String,
}

type Shared = Arc<App>;

const MAX_CONNS: usize = 1500;

#[tokio::main]
async fn main() {
    let app_key = std::env::var("APP_KEY").unwrap_or_default();
    if app_key.len() < 8 {
        eprintln!("APP_KEY is missing; refusing to start without a signing key");
        std::process::exit(2);
    }
    let state: Shared = Arc::new(App {
        stats: Stats { ok: Default::default(), rejected: Default::default(), last_reject: Mutex::new(String::new()) },
        hub: Mutex::new(Hub::default()),
        pusher_key: auth::derive(&app_key, "rt-key")[..20].to_string(),
        pusher_secret: auth::derive(&app_key, "rt-pusher"),
        join_key: auth::derive(&app_key, "rt-join"),
    });

    let tick = state.clone();
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(Duration::from_millis(33));
        iv.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            iv.tick().await;
            tick.hub.lock().unwrap().flush();
        }
    });

    let router = Router::new()
        .route("/app/:key", get(ws_upgrade))
        .route("/sse/:key", get(sse))
        .route("/apps/:app_id/events", post(publish))
        .route("/health", get(health))
        .layer(DefaultBodyLimit::max(16 * 1024))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind 9000");
    axum::serve(listener, router)
        .with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; })
        .await
        .unwrap();
}

async fn health(State(s): State<Shared>) -> impl IntoResponse {
    let h = s.hub.lock().unwrap();
    Json(json!({"ok": true, "service": "jd-realtime", "conns": h.conns.len(), "channels": h.channels.len(), "key": s.pusher_key}))
}

async fn ws_upgrade(
    headers: HeaderMap,
    ws: Result<WebSocketUpgrade, WebSocketUpgradeRejection>,
    Path(key): Path<String>,
    Query(q): Query<HashMap<String, String>>,
    State(s): State<Shared>,
) -> axum::response::Response {
    if key != s.pusher_key {
        return StatusCode::NOT_FOUND.into_response();
    }
    let ws = match ws {
        Ok(ws) => ws,
        Err(_) => {
            // Not a WebSocket handshake: say which hop headers arrived (no secrets), to debug proxies.
            let h = |n: &str| headers.get(n).and_then(|v| v.to_str().ok()).unwrap_or("-").to_string();
            return (StatusCode::UPGRADE_REQUIRED, Json(json!({"error": "websocket upgrade required", "connection": h("connection"), "upgrade": h("upgrade"), "version": h("sec-websocket-version"), "has_key": headers.contains_key("sec-websocket-key"), "published": s.stats.ok.load(std::sync::atomic::Ordering::Relaxed), "rejected": s.stats.rejected.load(std::sync::atomic::Ordering::Relaxed), "last_reject": s.stats.last_reject.lock().unwrap().clone(), "conns": s.hub.lock().unwrap().conns.len()}))).into_response();
        }
    };
    let Some(claims) = q.get("t").and_then(|t| auth::check_token(&s.join_key, t, auth::now())) else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
    if s.hub.lock().unwrap().conns.len() >= MAX_CONNS {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    let _ = claims.uid; // account link: guests are uid 0, members carry their user id
    ws.max_message_size(4096).on_upgrade(move |sock| client(sock, s, claims.slug))
}

fn data_channel(v: &Value) -> Option<String> {
    let d = match v.get("data")? {
        Value::String(s) => serde_json::from_str::<Value>(s).ok()?,
        o => o.clone(),
    };
    d.get("channel")?.as_str().map(|c| c.to_string())
}

async fn client(sock: WebSocket, s: Shared, slug: String) {
    let (mut tx_ws, mut rx_ws) = sock.split();
    let (tx, mut rx) = mpsc::channel::<Frame>(256);
    let id = s.hub.lock().unwrap().add(tx.clone(), slug);

    let hello = json!({"event":"pusher:connection_established","data":json!({"socket_id":format!("{id}.1"),"activity_timeout":30}).to_string()}).to_string();
    let _ = tx.try_send(hello.into());

    let writer = tokio::spawn(async move {
        while let Some(f) = rx.recv().await {
            if tx_ws.send(Message::Text(f.to_string())).await.is_err() {
                break;
            }
        }
    });

    loop {
        let next = tokio::time::timeout(Duration::from_secs(150), rx_ws.next()).await;
        let Ok(Some(Ok(msg))) = next else { break };
        let Message::Text(text) = msg else {
            if matches!(msg, Message::Close(_)) { break }
            continue;
        };
        let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
        let reply = match v.get("event").and_then(|e| e.as_str()) {
            Some("pusher:ping") => Some(json!({"event":"pusher:pong","data":"{}"}).to_string()),
            Some("pusher:subscribe") => {
                let ch = data_channel(&v).unwrap_or_default();
                let res = s.hub.lock().unwrap().subscribe(id, &ch);
                Some(match res {
                    Ok(_) => json!({"event":"pusher_internal:subscription_succeeded","channel":ch,"data":"{}"}).to_string(),
                    Err(e) => json!({"event":"pusher:error","data":json!({"code":4009,"message":e}).to_string()}).to_string(),
                })
            }
            Some("pusher:unsubscribe") => {
                if let Some(ch) = data_channel(&v) {
                    s.hub.lock().unwrap().unsubscribe(id, &ch);
                }
                None
            }
            _ => None,
        };
        if let Some(r) = reply {
            if tx.try_send(r.into()).is_err() {
                break;
            }
        }
    }
    s.hub.lock().unwrap().remove(id);
    writer.abort();
}

/// Pusher HTTP API subset, signed by Laravel's broadcaster over the internal network.
fn reject(s: &Shared, why: &str) -> axum::response::Response {
    s.stats.rejected.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    *s.stats.last_reject.lock().unwrap() = why.to_string();
    (StatusCode::UNAUTHORIZED, why.to_string()).into_response()
}

async fn publish(
    State(s): State<Shared>,
    Path(app_id): Path<String>,
    uri: Uri,
    Query(q): Query<HashMap<String, String>>,
    body: Bytes,
) -> impl IntoResponse {
    if app_id != "jdrt" || q.get("auth_key") != Some(&s.pusher_key) {
        return reject(&s, "bad app");
    }
    let ts: u64 = q.get("auth_timestamp").and_then(|t| t.parse().ok()).unwrap_or(0);
    if auth::now().abs_diff(ts) > 600 {
        return reject(&s, "stale");
    }
    let md5 = hex::encode(Md5::digest(&body));
    if q.get("body_md5") != Some(&md5) {
        return reject(&s, "md5");
    }
    let mut pairs: Vec<(&String, &String)> = q.iter().filter(|(k, _)| k.as_str() != "auth_signature").collect();
    pairs.sort();
    let qs = pairs.iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("&");
    let to_sign = format!("POST\n{}\n{}", uri.path(), qs);
    if !auth::verify(&s.pusher_secret, &to_sign, q.get("auth_signature").map(String::as_str).unwrap_or("")) {
        return reject(&s, "signature");
    }
    let Ok(v) = serde_json::from_slice::<Value>(&body) else {
        return (StatusCode::BAD_REQUEST, "json").into_response();
    };
    let name = v.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let data = v.get("data").and_then(|d| d.as_str()).unwrap_or("{}");
    let mut chans: Vec<String> = v.get("channels").and_then(|c| c.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
    if let Some(c) = v.get("channel").and_then(|c| c.as_str()) {
        chans.push(c.to_string());
    }
    if name.is_empty() || chans.is_empty() || chans.len() > 20 {
        return (StatusCode::BAD_REQUEST, "shape").into_response();
    }
    let mut h = s.hub.lock().unwrap();
    for ch in chans {
        let frame: Frame = json!({"event": name, "channel": ch, "data": data}).to_string().into();
        if name == "room.updated" {
            h.coalesce(&ch, frame);
        } else {
            h.publish(&ch, frame);
        }
    }
    s.stats.ok.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    (StatusCode::OK, Json(json!({}))).into_response()
}


/// Removes the connection from the hub when the HTTP stream is dropped.
struct Guard {
    s: Shared,
    id: u64,
}

impl Drop for Guard {
    fn drop(&mut self) {
        self.s.hub.lock().unwrap().remove(self.id);
    }
}

/// Server-Sent Events transport. The browser bridge uses it when the proxy in front
/// of the stack does not tunnel WebSockets. Same token, same channel scoping; the
/// client writes still go through Laravel's HTTP API as they always did.
async fn sse(
    Path(key): Path<String>,
    Query(q): Query<HashMap<String, String>>,
    State(s): State<Shared>,
) -> axum::response::Response {
    if key != s.pusher_key {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Some(claims) = q.get("t").and_then(|t| auth::check_token(&s.join_key, t, auth::now())) else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
    let chans: Vec<String> = q.get("c").map(|c| c.split(',').filter(|x| !x.is_empty()).take(hub::MAX_SUBS).map(String::from).collect()).unwrap_or_default();
    let (tx, rx) = mpsc::channel::<Frame>(256);
    let id = {
        let mut h = s.hub.lock().unwrap();
        if h.conns.len() >= MAX_CONNS {
            return StatusCode::SERVICE_UNAVAILABLE.into_response();
        }
        let id = h.add(tx, claims.slug);
        for ch in &chans {
            if h.subscribe(id, ch).is_err() {
                h.remove(id);
                return StatusCode::FORBIDDEN.into_response();
            }
        }
        id
    };
    let guard = Guard { s: s.clone(), id };
    let stream = futures_util::stream::unfold((rx, guard, true), |(mut rx, g, first)| async move {
        let chunk = if first {
            Bytes::from_static(b"data: {\"event\":\"jd:ready\"}\n\n")
        } else {
            match tokio::time::timeout(Duration::from_secs(20), rx.recv()).await {
                Ok(Some(f)) => Bytes::from(format!("data: {f}\n\n")),
                Ok(None) => return None,
                Err(_) => Bytes::from_static(b": ka\n\n"),
            }
        };
        Some((Ok::<Bytes, std::convert::Infallible>(chunk), (rx, g, false)))
    });
    axum::response::Response::builder()
        .header("content-type", "text/event-stream")
        .header("cache-control", "no-store")
        .header("x-accel-buffering", "no")
        .body(axum::body::Body::from_stream(stream))
        .unwrap()
}
