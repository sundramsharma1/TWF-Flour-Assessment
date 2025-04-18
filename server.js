const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();

app.use(bodyParser.json());

const centers = {
    'C1': { 'A': 3, 'B': 2, 'C': 8 },
    'C2': { 'D': 12, 'E': 25, 'F': 15 },
    'C3': { 'G': 0.5, 'H': 1, 'I': 2 }
};

const distances = {
    'C1': { 'C2': 4, 'L1': 3 },
    'C2': { 'C1': 4, 'C3': 3, 'L1': 2.5 },
    'C3': { 'C2': 3, 'L1': 2 },
    'L1': { 'C1': 3, 'C2': 2.5, 'C3': 2 }
};

function calculateSegmentCost(weight, distance) {
    let cost = 10;
    if (weight > 5) {
        cost += Math.ceil((weight - 5) / 5) * 8;
    }
    return cost * distance;
}

function getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const remainingPerms = getPermutations(remaining);
        for (const perm of remainingPerms) {
            result.push([current, ...perm]);
        }
    }
    return result;
}

function generatePossibleRoutes(requiredCenters) {
    if (requiredCenters.length === 1) {
        return [[requiredCenters[0], 'L1']];
    }
    const routes = [];
    const permutations = getPermutations(requiredCenters);
    for (const perm of permutations) {
        routes.push([...perm, 'L1']);
        for (let i = 1; i < perm.length; i++) {
            routes.push([...perm.slice(0, i), 'L1', ...perm.slice(i), 'L1']);
        }
    }
    return routes;
}

function calculateRouteCost(route, order) {
    let totalCost = 0;
    let currentWeight = 0;
    const collectedProducts = {};
    for (let i = 0; i < route.length - 1; i++) {
        const from = route[i];
        const to = route[i + 1];
        if (centers[from]) {
            const centerProducts = centers[from];
            for (const product in centerProducts) {
                if (order[product] > 0) {
                    const needed = order[product] - (collectedProducts[product] || 0);
                    if (needed > 0) {
                        currentWeight += centerProducts[product] * needed;
                        collectedProducts[product] = (collectedProducts[product] || 0) + needed;
                    }
                }
            }
        }
        const segmentDistance = distances[from]?.[to];
        if (segmentDistance === undefined) {
            throw new Error(`No distance found from ${from} to ${to}`);
        }
        totalCost += calculateSegmentCost(currentWeight, segmentDistance);
        if (to === 'L1') currentWeight = 0;
    }
    return totalCost;
}

app.post('/calculate-delivery-cost', (req, res) => {
    try {
        const order = req.body;

        if (!order || typeof order !== 'object' || Object.keys(order).length === 0) {
            return res.status(400).json({ error: 'Order cannot be empty or invalid format' });
        }

        for (const product in order) {
            const quantity = order[product];
            if (typeof quantity !== 'number' || quantity < 0) {
                return res.status(400).json({ error: `Invalid quantity for product ${product}` });
            }
        }

        const requiredCenters = [];
        for (const product in order) {
            if (order[product] > 0) {
                let found = false;
                for (const center in centers) {
                    if (centers[center][product] !== undefined) {
                        found = true;
                        if (!requiredCenters.includes(center)) {
                            requiredCenters.push(center);
                        }
                    }
                }
                if (!found) {
                    return res.status(400).json({ error: `Product '${product}' is not available at any center` });
                }
            }
        }

        if (requiredCenters.length === 0) {
            return res.json({ cost: 0, path: [] });
        }

        const possibleRoutes = generatePossibleRoutes(requiredCenters);
        let minCost = Infinity;
        let bestRoute = [];

        for (const route of possibleRoutes) {
            try {
                const cost = calculateRouteCost(route, order);
                if (cost < minCost) {
                    minCost = cost;
                    bestRoute = route;
                }
            } catch (err) {
                console.warn(`Skipping route due to error: ${err.message}`);
            }
        }

        res.json({ cost: minCost, path: bestRoute });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/', (req, res) => {
    res.send('Delivery cost API is running!');
});

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
