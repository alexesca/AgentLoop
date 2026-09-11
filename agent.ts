import * as readline from 'readline';

type ToolCall = { name: string; args: any };
type Message = { role: "user" | "assistant" | "toolResult"; content: any };
type LLMResponse = { text?: string; toolCall?: ToolCall };

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


// Mock llm
//
const llm = {
  async call(params: {system: string, messages: Message[]}): Promise<LLMResponse> {
    console.log(`\n [LLM] Thinking... (Evaluating ${params.messages.length} messages)`);
    // Fake network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const lastMessage = params.messages[params.messages.length - 1]!;

    // Llm decides to use a toolDefinitions
    if (lastMessage.role === "user" && lastMessage.content.toLowerCase().includes("multiply")) {
      return {
        toolCall: {
          name: "calculator", args: {a: 5, b: 5, operation: "multiply"}
        }
      };
    }

    // Last message waw a tool result
    if (lastMessage.role === "toolResult") {
      return {
        text: `Based on my tool, the answer is ${lastMessage.content}`
      };
    }

    // General chatter
    //
    return {text:  "I am a simple bot. Try asking me to 'multiply 5 by 5'."};
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
