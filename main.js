const { login, sendMessage, resendEchoes, toggleLogs } = require("./client");
const { client, xml } = require('@xmpp/client');
const fs = require('fs');
const readline = require('readline');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Disable TLS certificate validation (use with caution in production)
let routingToggle = true; // Toggle for routing logs

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Prompts the user for input and returns the input as a promise.
 * @param {string} query - The prompt to display to the user.
 * @returns {Promise<string>} - A promise that resolves to the user's input.
 */
const getInput = (query) => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
}

/**
 * Loads a JSON object from a specified file.
 * @param {string} filename - The name of the file to load.
 * @returns {Object} - The parsed JSON object from the file.
 */
const loadJSONFromFile = (filename) => {
    try {
        const data = fs.readFileSync(filename, 'utf8'); // Read file synchronously
        const jsonObject = JSON.parse(data); // Parse file content as JSON
        return jsonObject;
    } catch (err) {
        console.error("Error reading or parsing the file", err); // Log error if file reading or parsing fails
    }
}

/**
 * Main function to handle the logic for the XMPP client.
 * Prompts the user for node and password, logs into the XMPP server, 
 * and provides a menu for interacting with the client.
 */
const main = async () => {
    // Load the configuration and topology from files
    const names = loadJSONFromFile('./names.txt');
    const topo = loadJSONFromFile('./topo.txt');

    console.log(names); // Print the names object to the console

    // Prompt the user for the current node and password
    const currentNode = await getInput("Input the node to use in the topology: ");
    const password = await getInput("Input user password: ");

    // Log in to the XMPP server using the provided credentials
    const client = await login(names['config'][currentNode].split('@')[0], password, names, topo, currentNode);

    while (true) {

        // Display the menu options to the user
        setTimeout(async () => {
            console.log('\n------- LSR CLIENT -------');
            console.log('1. Send message');
            console.log('2. Resend echoes');
            console.log('3. Toggle Routing Logs');
            console.log('4. Exit');
            console.log('Pick a menu item: ')
        }, 1000);

        const userChoice = await getInput(""); // Get the user's menu choice

        // Handle the user's menu choice
        if (userChoice === '1') {
            const to = await getInput("Send message to (username): ");
            const payload = await getInput("Message to send: ");
            sendMessage(client, to, payload); // Send a message to the specified user
        }
        else if (userChoice === '2') {
            resendEchoes(client, names, topo, currentNode); // Resend echo messages
        }
        else if (userChoice === '3') {
            routingToggle = !routingToggle; // Toggle the routing logs on or off
            toggleLogs(routingToggle);
        }
        else {
            client.stop(); // Stop the XMPP client
            process.exit(0); // Exit the process
        }
    }
}

// Run the main function
main();
