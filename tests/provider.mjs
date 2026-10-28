// TEST HARNESS ONLY. The app never imports this file. This is not a demo fallback.
import { createServer } from "node:http";
import { fixture } from "./fixtures.ts";
if (!process.argv.includes("--test-only"))
  throw new Error("This controlled provider is for local testing only.");
let sequence = 0;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4100");
  if (request.method === "GET" && url.pathname === "/viewport") {
    const width = [390, 768, 1280].includes(
      Number(url.searchParams.get("width")),
    )
      ? Number(url.searchParams.get("width"))
      : 1280;
    const path = url.searchParams.get("path") ?? "/";
    const safePath = /^\/plan\/[a-f0-9-]{36}$/.test(path) ? path : "/";
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      `<!doctype html><html><head><title>DayMade test viewport · ${width}px</title><style>html,body{margin:0;background:#e8e6df}iframe{border:0;transform-origin:top left;display:block}</style></head><body><iframe title="DayMade ${width}px layout check" src="http://127.0.0.1:3000${safePath}" width="${width}" height="1600"></iframe><script>const frame=document.querySelector('iframe');function fit(){const scale=Math.min(1,innerWidth/${width});frame.style.transform='scale('+scale+')';document.body.style.height=(1600*scale)+'px';}fit();addEventListener('resize',fit);</script></body></html>`,
    );
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/messages") {
    response.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 100000) {
      response.writeHead(413).end();
      return;
    }
  }
  try {
    const body = JSON.parse(raw);
    const context = JSON.parse(body.messages[0].content);
    const plan = context.existing
      ? structuredClone(context.existing)
      : fixture();
    if (context.existing) {
      const activity =
        plan.activities.find((a) => a.id === context.replaceOnly) ??
        plan.activities[0];
      activity.name = "Alternative test lunch";
      activity.estimatedCost = 30;
    }
    const content = body.tools
      ? [
          {
            type: "server_tool_use",
            id: "test-search",
            name: "web_search",
            input: { query: "Controlled fixture source" },
          },
          {
            type: "web_search_tool_result",
            tool_use_id: "test-search",
            content: [
              {
                type: "web_search_result",
                title: "Test source",
                url: "https://example.org/venue",
                encrypted_content: "test-only",
              },
            ],
          },
          {
            type: "text",
            text: "CONTROLLED TEST DATA: these are fixture venues, not real recommendations.",
          },
        ]
      : [{ type: "text", text: JSON.stringify(plan) }];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        id: `msg_test_${++sequence}`,
        type: "message",
        role: "assistant",
        model: "daymade-controlled-test",
        content,
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        error: {
          type: "invalid_request_error",
          message: "Invalid test request",
        },
      }),
    );
  }
});
server.listen(4100, "127.0.0.1", () =>
  console.log(
    "CONTROLLED TEST PROVIDER on http://127.0.0.1:4100 — no live AI, venues, or external actions.",
  ),
);
