import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Discovery only. This script NEVER calls tools or requests an external action.
const url = new URL(process.env.WAJO_MCP_URL || "https://mcp.api.wajo.ai/fo");
if (url.protocol !== "https:")
  throw new Error("An HTTPS endpoint is required.");
const client = new Client(
  { name: "daymade-schema-inspector", version: "0.1.0" },
  { capabilities: {} },
);
try {
  await client.connect(new StreamableHTTPClientTransport(url), {
    timeout: 15000,
  });
  const { tools } = await client.listTools();
  console.log(
    JSON.stringify(
      {
        endpoint: url.toString(),
        inspectedAt: new Date().toISOString(),
        tools,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
