let dijkstra = async (graph, source) => {
    const distances = {};
    const previous = {};
    const queue = [];
  
    // Initialize distances and queue
    for (const node in graph) {
        distances[node] = Infinity;
        previous[node] = null;
        queue.push(node);
    }
    distances[source] = 0;
  
    while (queue.length) {
        // Sort queue by distance
        queue.sort((a, b) => distances[a] - distances[b]);
        const currentNode = queue.shift();
    
        for (const neighbor in graph[currentNode]) {
            const alt = distances[currentNode] + graph[currentNode][neighbor];
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                previous[neighbor] = currentNode;
            }
        }
    }
  
    // Build the routing table
    const routingTable = {};
    for (const dest in distances) {
      if (dest !== source) {
        routingTable[dest] = {
            nextHop: getNextHop(previous, dest),
            cost: distances[dest]
        };
      }
    }
    return routingTable;
}
  
function getNextHop(previous, dest, source) {
    let nextHop = dest;
    
    while (previous[nextHop] && previous[previous[nextHop]] !== null && previous[nextHop] !== source) {
      nextHop = previous[nextHop];
    }
  
    return previous[dest] === source ? dest : nextHop;
}
  
  

module.exports = { dijkstra };