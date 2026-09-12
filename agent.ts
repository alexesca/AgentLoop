import * as readline from 'readline';

type ToolCall = { name: string; args: any };
type Message = { role: "user" | "assistant" | "toolResult"; content: any };
type LLMResponse = { text?: string; toolCall?: ToolCall };


const MODEL = "qwen2.5:7b";
const LLM_URL = "http://localhost:11434/v1/chat/completions";


// executeTool function

function executeTool(toolCall: ToolCall): string {
  console.log(`\n [SYSTEM] Executing Tool: ${toolCall.name} with args:`, toolCall.args);

  if(toolCall.name === "calculator") {
    const a = Number(toolCall.args.a);
    const b = Number(toolCall.args.b);
    const { operation } = toolCall.args;

    if(operation === "multiply") return String(a * b);
    if(operation === "add") return String(a + b);
    if(operation === "multiply") return String(a * b);
    if(operation === "divide") {
      if (b === 0) return "cannot divide by zero";
      return String(a / b);
    }
  }
  return "Tool execution failed";
}

// Parse LLM response

function parseLLMResponse(raw: string): LLMResponse {
  const match = raw.match(/\{[\s\S]*\}/);
  if(!match) return { text: raw };

  try {
    const parsed = JSON.parse(match[0]);
    if(parsed.toolCall) return {toolCall: parsed.toolCall};
    if (typeof parsed.text === "string") return {text:parsed.text};
    return {text:raw};
  } catch {
    return {text: raw};
  }
}


const llm = {
  async call(params: {system: string, messages: Message[]}): Promise<LLMResponse> {
    console.log(`\n [LLM] Thinking... (Evaluating ${params.messages.length} messages)`);

    const messages = [
      {role: "system", content: params.system},
      ...params.messages.map((message) => {
        if(message.role === "toolResult") {
          return { role: "user", content: `Tool result: ${message.content}`};
        }
        return {
          role: message.role,
          content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
        };
      }),
    ];

    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({model: MODEL, messages, temperature: 0}),
    });

    if(!res.ok) {
      const error = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${error}`);
    }

    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "";
    return parseLLMResponse(raw);
  }
}

const rl = readline.createInterface({input: process.stdin, output: process.stdout});
const getInput = (): Promise<string> => new Promise(resolve => rl.question("\nYou: ", resolve));
const display = (text: string) => console.log(`\nAgent: ${text}`);

// The agent loop

const messages: Message[] = [];
const systemPrompt = `you are an agent with one tool: calculator

Reply with ONLY JSON. No markdown.

If the user asks you to do math, extract the two number and the operation from their message, then call the tool: {"toolCall": {
  "name": "calculator",
  "args": {"a": 12, "b": 4, "operation": "add"}
}}

operation must be on of: add, subtract, multiply, divide.

When you  are ready to talk to the user:

{"text": "your reply"}

After you receive a tool result, answer with {"text": "..."}.
`;

async function startAgent() {
  console.log("Agent started! Type 'exit' to quit.");

  // OUTER LOOP
  while (true) {
    const userInput = await getInput();
    if(userInput === "exit") break; // this breaks the outer loop
    
    messages.push({role: "user", content: userInput})

    // INNER LOOP
    while (true) {
      const response = await llm.call({
        system: systemPrompt,
        messages
      });

      // Stringify the response
      messages.push({role: "assistant", content: JSON.stringify(response)});

      if(response.toolCall){
        const result  = await executeTool(response.toolCall);
        messages.push({role: "toolResult", content: result});
        // Loop continues automatically back to llm.call()
      } else {
        display(response.text || "No response text.");
        break; // This breaks the inner loop
      }
    }
  }
  rl.close();
}

startAgent();
