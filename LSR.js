/**
 * Computes the shortest paths from a source node to all other nodes in a graph using Dijkstra's algorithm.
 * @param {Object} graph - The graph represented as an adjacency list where keys are node names 
 * and values are objects with neighboring nodes and their corresponding edge weights.
 * @param {string} source - The starting node for the algorithm.
 * @returns {Object} - A routing table containing the next hop and the cost to each destination node.
 */
let dijkstra = async (graph, source) => {
    const distances = {}; // Stores the shortest known distances to each node
    const previous = {}; // Stores the previous node in the shortest path
    const queue = []; // Priority queue of nodes to be processed
  
    // Initialize distances to infinity and set previous nodes to null
    for (const node in graph) {
        distances[node] = Infinity; // Initially, all distances are set to infinity
        previous[node] = null; // No previous nodes are known yet
        queue.push(node); // Add each node to the queue
    }
    distances[source] = 0; // The distance to the source node is 0
  
    // Main loop for Dijkstra's algorithm
    while (queue.length) {
        // Sort the queue by distance, so the node with the smallest distance is first
        queue.sort((a, b) => distances[a] - distances[b]);
        const currentNode = queue.shift(); // Remove and return the node with the smallest distance
    
        // Check each neighbor of the current node
        for (const neighbor in graph[currentNode]) {
            const alt = distances[currentNode] + graph[currentNode][neighbor]; // Calculate the alternative path distance
            if (alt < distances[neighbor]) { // If the alternative path is shorter
                distances[neighbor] = alt; // Update the shortest distance to this neighbor
                previous[neighbor] = currentNode; // Update the previous node to the current node
            }
        }
    }
  
    // Build the routing table from the computed distances and previous nodes
    const routingTable = {};
    for (const dest in distances) {
        if (dest !== source) { // Exclude the source node from the routing table
            routingTable[dest] = {
                nextHop: getNextHop(previous, dest, source), // Determine the next hop towards the destination
                cost: distances[dest] // The cost to reach the destination
            };
        }
    }
    return routingTable; // Return the routing table
}

/**
 * Determines the next hop towards the destination node in the shortest path.
 * @param {Object} previous - The map of previous nodes in the shortest path.
 * @param {string} dest - The destination node.
 * @param {string} source - The source node.
 * @returns {string} - The next hop node towards the destination.
 */
function getNextHop(previous, dest, source) {
    let nextHop = dest;
    
    // Traverse backwards from the destination to the source to find the next hop
    while (previous[nextHop] && previous[previous[nextHop]] !== null && previous[nextHop] !== source) {
        nextHop = previous[nextHop];
    }
  
    // If the previous node is the source, return the destination itself as the next hop, otherwise return the next hop
    return previous[dest] === source ? dest : nextHop;
}

module.exports = { dijkstra };
