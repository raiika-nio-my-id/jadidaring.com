use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::mpsc;

pub type Frame = Arc<str>;

pub struct Conn {
    pub tx: mpsc::Sender<Frame>,
    pub slug: String,
    pub channels: HashSet<String>,
}

#[derive(Default)]
pub struct Hub {
    next: u64,
    pub conns: HashMap<u64, Conn>,
    pub channels: HashMap<String, HashSet<u64>>,
    /// room.updated carries only a version, so the newest frame per channel wins
    /// inside one 33 ms tick (30 Hz cap). room.input is never coalesced.
    pending: HashMap<String, Frame>,
}

pub const MAX_SUBS: usize = 4;

/// A channel is allowed when it is the game's lobby or one of its room channels.
pub fn channel_ok(slug: &str, ch: &str) -> bool {
    let base = format!("game.{slug}");
    ch.len() <= 96 && (ch == base || (ch.starts_with(&base) && ch.as_bytes().get(base.len()) == Some(&b'.') && ch.len() > base.len() + 1 && ch[base.len() + 1..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')))
}

impl Hub {
    pub fn add(&mut self, tx: mpsc::Sender<Frame>, slug: String) -> u64 {
        self.next += 1;
        self.conns.insert(self.next, Conn { tx, slug, channels: HashSet::new() });
        self.next
    }

    pub fn remove(&mut self, id: u64) {
        if let Some(c) = self.conns.remove(&id) {
            for ch in c.channels {
                if let Some(set) = self.channels.get_mut(&ch) {
                    set.remove(&id);
                    if set.is_empty() {
                        self.channels.remove(&ch);
                    }
                }
            }
        }
    }

    pub fn subscribe(&mut self, id: u64, ch: &str) -> Result<(), &'static str> {
        let Some(c) = self.conns.get_mut(&id) else { return Err("gone") };
        if !channel_ok(&c.slug, ch) {
            return Err("forbidden channel");
        }
        if !c.channels.contains(ch) && c.channels.len() >= MAX_SUBS {
            return Err("too many channels");
        }
        c.channels.insert(ch.to_string());
        self.channels.entry(ch.to_string()).or_default().insert(id);
        Ok(())
    }

    pub fn unsubscribe(&mut self, id: u64, ch: &str) {
        if let Some(c) = self.conns.get_mut(&id) {
            c.channels.remove(ch);
        }
        if let Some(set) = self.channels.get_mut(ch) {
            set.remove(&id);
            if set.is_empty() {
                self.channels.remove(ch);
            }
        }
    }

    /// Sends a frame to every subscriber. A client whose queue is full is too slow
    /// to keep and is dropped; it reconnects and catches up from Laravel.
    pub fn publish(&mut self, ch: &str, frame: Frame) -> usize {
        let Some(ids) = self.channels.get(ch) else { return 0 };
        let mut dead = Vec::new();
        let mut sent = 0;
        for id in ids {
            if let Some(c) = self.conns.get(id) {
                match c.tx.try_send(frame.clone()) {
                    Ok(_) => sent += 1,
                    Err(_) => dead.push(*id),
                }
            }
        }
        for id in dead {
            self.remove(id);
        }
        sent
    }

    pub fn coalesce(&mut self, ch: &str, frame: Frame) {
        self.pending.insert(ch.to_string(), frame);
    }

    pub fn flush(&mut self) {
        if self.pending.is_empty() {
            return;
        }
        let batch: Vec<(String, Frame)> = self.pending.drain().collect();
        for (ch, f) in batch {
            self.publish(&ch, f);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channel_scope() {
        assert!(channel_ok("mahjong", "game.mahjong"));
        assert!(channel_ok("mahjong", "game.mahjong.AB12"));
        assert!(!channel_ok("mahjong", "game.mahjong-master.AB12"));
        assert!(!channel_ok("mahjong", "game.other.AB12"));
        assert!(!channel_ok("mahjong", "private-x"));
        assert!(!channel_ok("mahjong", "game.mahjong."));
    }

    #[test]
    fn coalesces_and_fans_out() {
        let mut h = Hub::default();
        let (t1, mut r1) = mpsc::channel(8);
        let (t2, mut r2) = mpsc::channel(8);
        let a = h.add(t1, "mahjong".into());
        let b = h.add(t2, "mahjong".into());
        h.subscribe(a, "game.mahjong.X").unwrap();
        h.subscribe(b, "game.mahjong.X").unwrap();
        assert!(h.subscribe(b, "game.drag201.X").is_err());
        h.coalesce("game.mahjong.X", "v1".into());
        h.coalesce("game.mahjong.X", "v2".into());
        h.flush();
        assert_eq!(&*r1.try_recv().unwrap(), "v2");
        assert_eq!(&*r2.try_recv().unwrap(), "v2");
        assert!(r1.try_recv().is_err());
        h.remove(a);
        assert_eq!(h.publish("game.mahjong.X", "z".into()), 1);
    }
}
