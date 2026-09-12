# Agent Loop Workshop

A tiny TypeScript agent. You already have the loop. This tutorial keeps that loop and makes two changes:

1. Replace the mock LLM with a real call to the local model you are running.
2. Teach the calculator to do all four operations, using numbers from the user's message.

Do the edits yourself in `agent.ts`. The loop at the bottom of the file does not need to change.

## What you already have

Every agent is two loops. Yours are already written in `startAgent()`:

1. **Outer loop** — wait for the user, send their message, print the answer.
2. **Inner loop** — call the model. If it wants a tool, run the tool and call the model again. Repeat until it has text for the user.

```
You type something
        │
        ▼
┌───────────────────┐
│  call the LLM     │◄──────────────┐
└─────────┬─────────┘               │
          │                         │
    wants a tool?                   │
          │                         │
     yes ─┴─ no                     │
      │       │                     │
      ▼       ▼                     │
 run tool   print answer            │
      │                             │
      └─────────────────────────────┘
```

Run the starting code:

```bash
npm install
npx ts-node agent.ts
```

Ask it to `multiply 5 by 5`. The mock always uses `a: 5, b: 5`. That is the bug you are about to fix.

Type `exit` to quit.

## 1. Call your local LLM

You are running Ollama. It already speaks the OpenAI chat API at:

```
http://localhost:11434/v1/chat/completions
```

At the top of `agent.ts`, add a model name you can change later:

```ts
const MODEL = "qwen2.5:7b";
const LLM_URL = "http://localhost:11434/v1/chat/completions";
```

Delete the mock `llm` object (the fake delay and the hardcoded `5 * 5`). Replace it with a real `fetch`.

The model should reply with **JSON only**:

- `{"toolCall":{...}}` when it needs the calculator
- `{"text":"..."}` when it is ready to talk to you

That way `startAgent()` can keep using `response.toolCall` and `response.text`.

```ts
function parseLLMResponse(raw: string): LLMResponse {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { text: raw };

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.toolCall) return { toolCall: parsed.toolCall };
    if (typeof parsed.text === "string") return { text: parsed.text };
    return { text: raw };
  } catch {
    return { text: raw };
  }
}

const llm = {
  async call(params: { system: string; messages: Message[] }): Promise<LLMResponse> {
    console.log(`\n [LLM] Thinking... (Evaluating ${params.messages.length} messages)`);

    const messages = [
      { role: "system", content: params.system },
      ...params.messages.map((message) => {
        if (message.role === "toolResult") {
          return { role: "user", content: `Tool result: ${message.content}` };
        }
        return {
          role: message.role,
          content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
        };
      }),
    ];

    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${error}`);
    }

    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "";
    return parseLLMResponse(raw);
  },
};
```

Ollama does not understand the role `toolResult`, so that branch is sent as a user message: `Tool result: 84`.

## 2. Tell the model about the tool

The mock never read `systemPrompt`. A real model will.

Replace the current system strings with one prompt that says: reply with JSON, extract the two numbers from the user, and pick an operation.

```ts
const systemPrompt = `You are an agent with one tool: calculator.

Reply with ONLY JSON. No markdown.

If the user asks you to do math, extract the two numbers and the operation from their message, then call the tool:
{"toolCall":{"name":"calculator","args":{"a":12,"b":4,"operation":"add"}}}

operation must be one of: add, subtract, multiply, divide.

When you are ready to talk to the user:
{"text":"your reply"}

After you receive a tool result, answer with {"text":"..."}.`;
```

You can drop `memoryFiles` and `toolDefinitions`. Pass `systemPrompt` into `llm.call`.

The model does **not** do the math. It only fills in three fields from the user's sentence:

| Field | Meaning |
| --- | --- |
| `a` | first number |
| `b` | second number |
| `operation` | `add`, `subtract`, `multiply`, or `divide` |

So `what is 12 times 7?` should become:

```json
{
  "toolCall": {
    "name": "calculator",
    "args": { "a": 12, "b": 7, "operation": "multiply" }
  }
}
```

## 3. Do all four operations

`executeTool` currently handles `multiply` and `add`. Add `subtract` and `divide`. Coerce `a` and `b` with `Number(...)` because the model may send them as strings.

```ts
function executeTool(toolCall: ToolCall): string {
  console.log(`\n [SYSTEM] Executing Tool: ${toolCall.name} with args:`, toolCall.args);

  if (toolCall.name === "calculator") {
    const a = Number(toolCall.args.a);
    const b = Number(toolCall.args.b);
    const { operation } = toolCall.args;

    if (operation === "add") return String(a + b);
    if (operation === "subtract") return String(a - b);
    if (operation === "multiply") return String(a * b);
    if (operation === "divide") {
      if (b === 0) return "Cannot divide by zero";
      return String(a / b);
    }
  }

  return "Tool execution failed";
}
```

Leave the inner loop alone. After the tool returns `"84"`, it calls the model again, and the model should answer in plain English.

## Try it

```bash
npx ts-node agent.ts
```

```
what is 12 times 7?
add 3 and 9
what's 20 divided by 4?
subtract 15 from 40
hello
```

You should see the tool run with the numbers from your sentence, then a normal reply.

If the model name is wrong, change `MODEL` at the top of `agent.ts`.
