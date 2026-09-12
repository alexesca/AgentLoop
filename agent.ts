import * as readline from 'readline';

type ToolCall = { name: string; args: any };
type Message = { role: "user" | "assistant" | "toolResult"; content: any };
type LLMResponse = { text?: string; toolCall?: ToolCall };


const MODEL = "qwen2.5:7b";
const LLM_URL = "http://localhost:11434/v1/chat/completions";


// executeTool function


async function executeTool(toolCall: ToolCall): Promise<string> {
  console.log(`\n [SYSTEM] Executing Tool: ${toolCall.name} with args:`, toolCall.args);

  if(toolCall.name === "calculator") {
    const { a, b, operation } = toolCall.args;
    if(operation === "multiply") return String(a * b);
    if(operation === "add") return String(a + b);
  }
  return "Tool execution failed";
}

// Parse LLM response

function parseLLMResponse(raw: string): LLMResponse {
  const match = raw.match(/\{[\s\S]*\}/);
  if(!match) return { test:raw };

  try {
    const parsed = JSON.parse(match[0]);
    if(parsed.toolCall) return {toolCall: parsed.toolCall};
    if (typeof parsed.text === "string") return {text:parsed.text};
    return {text:raw};
  } catch {
    return {test: raw};
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
    cosnt raw: string = data.choices?.[0]?.message?.content ?? "";
    return parseLLMResponse(raw);
  }
}

const rl = readline.createInterface({input: process.stdin, output: process.stdout});
const getInput = (): Promise<string> => new Promise(resolve => rl.question("\nYou: ", resolve));
const display = (text: string) => console.log(`\nAgent: ${text}`);

// The agent loop

const messages: Message[] = [];
const systemPrompt = "you are an agent.";
const memoryFiles = "";
const toolDefinitions = " [Available tools: calculator]";

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
        system: systemPrompt + memoryFiles + toolDefinitions,
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
