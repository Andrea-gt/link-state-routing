const { client, xml } = require('@xmpp/client');
const debug = require('@xmpp/debug');
const { dijkstra } = require('./LSR');

let XMPPclient;
let echoTimes = {};
let knownTimes = {};
let routingTable = {};
let logs = true;

/**
 * Logs in to the XMPP server and initializes the client.
 * @param {string} username - The username for the XMPP client.
 * @param {string} password - The password for the XMPP client.
 * @param {Object} names - Mapping of node names to XMPP addresses.
 * @param {Object} topo - Topology information about the network.
 * @param {string} currentNode - The current node's identifier.
 * @returns {Object} The initialized XMPP client.
 */
const login = async (username, password, names, topo, currentNode) => {
	// Create a new XMPP client with the provided username and password
	XMPPclient = client({
		service: 'ws://alumchat.lol:7070/ws/',
		domain: 'alumchat.lol',
		username: username,
		password: password,
	});

	// Uncomment the line below to enable debug logging for XMPP client
	// debug(XMPPclient, true);

	XMPPclient.on('online', async (address) => {
		console.log(`Connected as ${address.toString()}`);

		// Send initial presence to announce availability
		XMPPclient.send(xml('presence'));

		// Initialize knownTimes for the current node
		knownTimes[names['config'][currentNode]] = {};

		// Start sending echo messages after a short delay
		setTimeout(() => {
			topo['config'][currentNode].forEach(element => {
				const timestamp = Date.now();
				echoTimes[names['config'][element]] = timestamp;
	
				// Send an echo message to each neighboring node
				XMPPclient.send(
					xml('message', { 'type': 'normal', 'to': names['config'][element] },
						xml('type', {}, 'echo'),
						xml('body', {}, 'echo'),
						xml('hops', {}, '1')
					)
				);
			});
		}, 2000);
	});

	XMPPclient.on('stanza', async (stanza) => {
		// Handle received stanza (XMPP message)
        if (stanza.is('message') && stanza.getChildText('type') === 'echo') {
            const fromNode = stanza.attrs.from.split('/')[0];
            const hops = stanza.getChildText('hops');

            if (hops === '1') {
                // Respond to an echo request with a hop count of 2
                XMPPclient.send(
                    xml('message', { 'to': fromNode },
                        xml('type', {}, 'echo'),
                        xml('body', {}, stanza.getChild('body').text()),
                        xml('hops', {}, '2')
                    )
                );

				// Send a new echo message if not already known
				if (!knownTimes[names['config'][currentNode]][fromNode]) {
					const timestamp = Date.now();
					echoTimes[fromNode] = timestamp;
		
					XMPPclient.send(
						xml('message', { 'type': 'normal', 'to': fromNode },
							xml('type', {}, 'echo'),
							xml('body', {}, 'echo'),
							xml('hops', {}, '1')
						)
					);
				}

            } else if (hops === '2') {
                // Calculate round-trip time and update known times
                const sentTime = echoTimes[fromNode];
                if (sentTime) {
                    const roundTripTime = Date.now() - sentTime;
                    console.log(`Round-trip time to ${fromNode}: ${roundTripTime} ms`);
                    delete echoTimes[fromNode];

                    if (!knownTimes[names['config'][currentNode]]) {
                        knownTimes[names['config'][currentNode]] = {};
                    }

                    knownTimes[names['config'][currentNode]][fromNode] = roundTripTime;

					// Start flooding the network with updated round-trip times
					startFlood(XMPPclient, topo['config'][currentNode].map(node => {
						return names['config'][node];
					}));
                }
            }
        } 
		else if (stanza.is('message') && stanza.getChildText('type') === 'info') {
            // Handle information messages containing known times
            const receivedTimes = JSON.parse(stanza.getChild('table').getText());

            mergeKnownTimes(receivedTimes, names['config'][currentNode]);

			// Propagate the flood if the message has no flood headers
			if (!stanza.getChild('headers')) {
				propagateFlood(XMPPclient, stanza, topo['config'][currentNode].map(node => {
					return names['config'][node];
				}));

				// Send acknowledgment back to the source of the flood
				XMPPclient.send(
					xml('message', { to: stanza.attrs.from.split('/')[0] },
						xml('type', {}, 'info'),
						xml('headers', {}, ['no-flood']),
						xml('table', {}, 
							JSON.stringify(knownTimes)
						),
						xml('hops', {}, 1)
					)
				);
			}

        } 
		else if (stanza.is('message') && stanza.attrs.type === 'chat') {
			// Handle chat messages and forward them based on the routing table
			const message = JSON.parse(stanza.getChildText('body'));

			if (message.to === `${XMPPclient.jid._local}@alumchat.lol`) {
				console.log(`\nMESSAGE RECEIVED FROM ${message.from} AFTER ${message.hops} HOPS: ${message.payload}\n`);
			} 
			else {
				// Forward the message to the next hop
				if (routingTable[message.to]) {
					const nextHop = routingTable[message.to]['nextHop'];
					console.log(`\nFORWARDING MESSAGE FROM ${stanza.attrs.from.split('/')[0]} TO ${nextHop}\n`);
					XMPPclient.send(xml('message', { to: nextHop, type: 'chat' }, 
						xml('body', {}, JSON.stringify({
							type: 'message',
							from: message.from,
							to: message.to,
							headers: message.headers,
							hops: parseInt(message.hops) + 1,
							payload: message.payload,
						})))
					);
				}
				else {
					console.error(`\nFORWARDING ERROR: No viable route found for the message (to: ${message.to})\n`);
				}
			}
		}
    });

	XMPPclient.on('error', (err) => {
		// Log any errors that occur
		console.error('ERROR', err);
	});

	XMPPclient.on('offline', () => {
		// Handle client going offline
		console.log('Disconnected');
	});

	// Start the XMPP client
	XMPPclient.start().catch(console.error);

	return XMPPclient;
}

/**
 * Initiates the flooding process by sending known times to neighboring nodes.
 * @param {Object} client - The XMPP client instance.
 * @param {Array<string>} neighbors - List of neighboring node addresses.
 */
const startFlood = (client, neighbors) => {
	//console.log('STARTING FLOOD')
	neighbors.forEach(neighbor => {
		client.send(
			xml('message', { to: neighbor },
				xml('type', {}, 'info'),
				xml('table', {}, 
					JSON.stringify(knownTimes)
				),
				xml('visited', {}, 
					neighbors.map(element => xml('node', { name: element }))
				),
				xml('hops', {}, 1)
			)
		);
	});
};

/**
 * Propagates a flood message to neighboring nodes that haven't received it.
 * @param {Object} client - The XMPP client instance.
 * @param {Object} floodMsg - The flood message stanza received.
 * @param {Array<string>} neighbors - List of neighboring node addresses.
 */
const propagateFlood = (client, floodMsg, neighbors) => {
	//console.log('PROPAGATING FLOOD')
	let visited = floodMsg.getChild('visited').getChildren('node').map(entry => {
		return entry.attrs.name;
	});

	neighbors.forEach(neighbor => {
		if (!visited.includes(neighbor)) {
			let newVisited = [...visited, ...neighbors];
			client.send(
				xml('message', { to: neighbor, id: floodMsg.attrs.id },
					xml('type', {}, 'info'),
					xml('table', {}, 
						floodMsg.getChildText('table')
					),
					xml('visited', {}, 
						newVisited.map(element => xml('node', { name: element }))
					),
					xml('hops', {}, parseInt(floodMsg.getChildText('hops')) + 1)
				)
			);
		}
	});
};

/**
 * Merges received round-trip times with the known times and updates the routing table.
 * @param {Object} receivedTimes - The round-trip times received from another node.
 * @param {string} source - The source node's identifier.
 */
const mergeKnownTimes = async (receivedTimes, source) => {
    for (const node in receivedTimes) {
        if (!knownTimes[node]) {
            knownTimes[node] = receivedTimes[node];
        } else {
            for (const target in receivedTimes[node]) {
                if (!knownTimes[node][target] || receivedTimes[node][target] < knownTimes[node][target]) {
                    knownTimes[node][target] = receivedTimes[node][target];
                }
            }
        }
    }

    // Update the routing table using Dijkstra's algorithm
    routingTable = await dijkstra(knownTimes, source);

    // Log the updated routing table if logging is enabled
    if (logs) {
        console.log('\nUPDATED ROUTING TABLE');
        console.log(routingTable);
    }
};

/**
 * Sends a message to a specified recipient, determining the next hop based on the routing table.
 * @param {Object} client - The XMPP client instance.
 * @param {string} to - The recipient's identifier.
 * @param {string} payload - The message payload to be sent.
 */
const sendMessage = (client, to, payload) => {
	if (!routingTable[`${to}@alumchat.lol`]) {
		console.log('ERROR: No viable route found for the message');
		return;
	}
    const nextHop = routingTable[`${to}@alumchat.lol`]['nextHop'];
    client.send(xml('message', { to: nextHop, type: 'chat' }, 
        xml('body', {}, JSON.stringify({
            type: 'message',
            from: `${client.jid._local}@alumchat.lol`,
            to: `${to}@alumchat.lol`,
            headers: [],
            hops: 1,
            payload: payload,
        })))
    );
};

/**
 * Resends echo messages to all neighboring nodes to measure round-trip times again.
 * @param {Object} client - The XMPP client instance.
 * @param {Object} names - Mapping of node names to XMPP addresses.
 * @param {Object} topo - Topology information about the network.
 * @param {string} currentNode - The current node's identifier.
 */
const resendEchoes = (client, names, topo, currentNode) => {
    topo['config'][currentNode].forEach(element => {
        const timestamp = Date.now();
        echoTimes[names['config'][element]] = timestamp;

        // Send an echo message to each neighboring node
        client.send(
            xml('message', { 'type': 'normal', 'to': names['config'][element] },
                xml('type', {}, 'echo'),
                xml('body', {}, 'echo'),
                xml('hops', {}, '1')
            )
        );
    });
};

/**
 * Toggles the logging of routing table updates and other debug information.
 * @param {boolean} newValue - The new value for the logging setting (true to enable, false to disable).
 */
const toggleLogs = (newValue) => {
    logs = newValue;
};

module.exports = { login, sendMessage, resendEchoes, toggleLogs };

