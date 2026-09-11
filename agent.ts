import * as readline from 'readline';
const rl = readline.createInterface({input: process.stdin, outpu: process.stdout});
const getInput = (): Promise<string> => new Promise(resolve => rl.question("\nYout: ", resolve));
const display = (text: string) => console.log(`\nAgent: ${text}`);

// The agent loop

const messages: Message[] = [];
const systemPrompt = "you are an agent.";
const memoryFiles = "";
const toolDefinitions = " [Available tools: calculator]";

async funciton startAgent() {
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
      message.push({role: "assistant", content: JSON.stringify(response)});

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
