//! Key derivation and join tokens. Laravel and this service share only APP_KEY;
//! every sub-key is an HMAC of a fixed label, so nothing new is stored in .env.
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type H = Hmac<Sha256>;

pub fn derive(app_key: &str, label: &str) -> String {
    let mut m = H::new_from_slice(app_key.as_bytes()).unwrap();
    m.update(label.as_bytes());
    hex::encode(m.finalize().into_bytes())
}

pub fn sign(key: &str, msg: &str) -> Vec<u8> {
    let mut m = H::new_from_slice(key.as_bytes()).unwrap();
    m.update(msg.as_bytes());
    m.finalize().into_bytes().to_vec()
}

pub fn verify(key: &str, msg: &str, sig_hex: &str) -> bool {
    let Ok(sig) = hex::decode(sig_hex) else { return false };
    let mut m = H::new_from_slice(key.as_bytes()).unwrap();
    m.update(msg.as_bytes());
    m.verify_slice(&sig).is_ok()
}

pub fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

pub struct Claims {
    pub uid: u64,
    pub slug: String,
}

/// Token: v1.<exp>.<uid>.<slug>.<hexsig>, signed over the first four parts.
pub fn check_token(join_key: &str, token: &str, at: u64) -> Option<Claims> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 5 || parts[0] != "v1" {
        return None;
    }
    let exp: u64 = parts[1].parse().ok()?;
    let uid: u64 = parts[2].parse().ok()?;
    let slug = parts[3];
    if exp < at || slug.is_empty() || slug.len() > 64 || !slug.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-') {
        return None;
    }
    let msg = format!("v1.{}.{}.{}", parts[1], parts[2], slug);
    if !verify(join_key, &msg, parts[4]) {
        return None;
    }
    Some(Claims { uid, slug: slug.to_string() })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn token_roundtrip() {
        let k = derive("base64:abc", "rt-join");
        let msg = "v1.2000.7.mahjong";
        let tok = format!("{}.{}", msg, hex::encode(sign(&k, msg)));
        assert!(check_token(&k, &tok, 1000).is_some());
        assert!(check_token(&k, &tok, 2001).is_none());
        let bad = tok.replace("mahjong", "drawquarium");
        assert!(check_token(&k, &bad, 1000).is_none());
        assert!(check_token(&k, "garbage", 1000).is_none());
        assert!(check_token(&derive("other", "rt-join"), &tok, 1000).is_none());
    }
}
