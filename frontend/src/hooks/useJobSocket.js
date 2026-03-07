import { useEffect, useRef, useState } from "react";

/**
 * Connects to ws://.../ws/jobs/<jobId>/ and pushes present_job payload updates.
 * Dev/demo: no WS auth yet.
 */
export function useJobSocket(jobId) {
  const [lastMessage, setLastMessage] = useState(null);
  const [status, setStatus] = useState("idle"); // idle|connecting|open|closed|error
  const wsRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    setStatus("connecting");
    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/jobs/${jobId}/`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");
    ws.onmessage = (e) => {
      try {
        setLastMessage(JSON.parse(e.data));
      } catch {
        // ignore
      }
    };

    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [jobId]);

  return { status, lastMessage };
}