const { login, sendMessage } = require("./client");
const { client, xml } = require('@xmpp/client');
const fs = require('fs');
const readline = require('readline');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
const getInput = (query) => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
        resolve(answer);
        });
    });
}

const loadJSONFromFile = (filename) => {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        const jsonObject = JSON.parse(data);
        return jsonObject;
    } catch (err) {
        console.error("Error reading or parsing the file", err);
    }
}

const main = async () => {
    const names = loadJSONFromFile('./names.txt');
    const topo = loadJSONFromFile('./topo.txt');

    console.log(names)

    const currentNode = await getInput("Input the node to use in the topology: ")

    const client = await login(names['config'][currentNode].split('@')[0], 'g', names, topo, currentNode);

    while(true){
        
        setTimeout(async () => {
            console.log('----LSR CLIENT----');
            console.log('1. Send message');
            console.log('2. Exit');
            console.log('Pick a menu item: ')
        }, 1000);
        
        const userChoice = await getInput("");

        if (userChoice === '1') {
            const to = await getInput("Send message to (username): ");
            const payload = await getInput("Message to send: ");
            sendMessage(client, to, payload);
        }
        else {
            break;
        }

    }

    return

}

main()
