const { login } = require("./client");
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

// Function to read the file and parse the JSON content
const loadJSONFromFile = (filename) => {
    try {
        const data = fs.readFileSync(filename, 'utf8');  // Read the file
        const jsonObject = JSON.parse(data);  // Parse the JSON content
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

    const client = login(names['config'][currentNode].split('@')[0], 'g', names, topo, currentNode);

}

main()
