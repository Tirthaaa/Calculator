const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to local SQLite Database
const db = new sqlite3.Database('./calculator.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to SQLite Database.");
});

// Create table structure
db.run(`CREATE TABLE IF NOT EXISTS calculation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expression TEXT NOT NULL,
    evaluation_ans TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Post math request processing route
app.post('/api/compute', (req, res) => {
    const { expression } = req.body;

    if (!expression) {
        return res.status(400).json({ success: false, error: "Empty expression" });
    }

    if (/[^0-9\+\-\*\/\.\(\)]/.test(expression)) {
        return res.status(400).json({ success: false, error: "Security Alert: Invalid characters" });
    }

    try {
        const result = Function(`"use strict"; return (${expression})`)();
        
        if (result === Infinity || result === -Infinity) {
            return res.status(400).json({ success: false, error: "Cannot divide by zero" });
        }

        const query = `INSERT INTO calculation_log (expression, evaluation_ans) VALUES (?, ?)`;
        db.run(query, [expression, String(result)], function(err) {
            if (err) return res.status(500).json({ success: false, error: "Database error" });
            res.json({ success: true, result });
        });
    } catch (error) {
        res.status(400).json({ success: false, error: "Format Error" });
    }
});

// Fetch past computational history route
app.get('/api/history', (req, res) => {
    db.all(`SELECT expression, evaluation_ans FROM calculation_log ORDER BY id DESC LIMIT 20`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, history: rows });
    });
});

// Root Serve: Clean single-panel interface with toggleable history
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Minimalist Smart Calculator</title>
        <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                background: linear-gradient(135deg, #0f1115 0%, #1a1d24 100%); 
                margin: 0; 
                padding: 20px; 
            }
            .calculator-card { 
                position: relative;
                background: rgba(30, 34, 42, 0.75); 
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 24px; 
                box-shadow: 0 20px 50px rgba(0,0,0,0.4); 
                overflow: hidden; 
                width: 340px; 
                padding: 25px;
                display: flex;
                flex-direction: column;
            }
            .header-actions {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 5px;
            }
            .history-toggle-btn {
                background: none;
                border: none;
                color: #5c6370;
                font-size: 1.3rem;
                cursor: pointer;
                padding: 5px;
                transition: color 0.2s;
            }
            .history-toggle-btn:hover {
                color: #2196f3;
            }
            #display { 
                width: 100%; 
                height: 70px; 
                background: transparent; 
                border: none; 
                color: #fff; 
                text-align: right; 
                padding: 10px 0; 
                font-size: 2.4rem; 
                font-weight: 300;
                letter-spacing: -1px;
                outline: none; 
                margin-bottom: 15px;
            }
            .grid { 
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 12px; 
            }
            button.calc-btn { 
                padding: 18px; 
                font-size: 1.25rem; 
                border: none; 
                border-radius: 16px; 
                cursor: pointer; 
                background: #282c34; 
                color: #abb2bf; 
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
            }
            button.calc-btn:hover { 
                background: #323842; 
                color: #fff;
                transform: translateY(-2px);
            }
            button.calc-btn:active {
                transform: translateY(0);
            }
            button.operator { 
                background: rgba(255, 159, 10, 0.15); 
                color: #ff9f0a; 
                font-weight: 600;
            }
            button.operator:hover { 
                background: #ff9f0a; 
                color: #fff; 
            }
            button.clear { 
                background: rgba(244, 67, 54, 0.15); 
                color: #f44336; 
            }
            button.clear:hover { 
                background: #f44336; 
                color: #fff; 
            }
            button.equal { 
                grid-column: span 2; 
                background: #2196f3; 
                color: #fff;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
            }
            button.equal:hover { 
                background: #1e88e5; 
                box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
            }

            /* Sliding Overlay History Panel */
            .overlay-history {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #14161c;
                border-radius: 24px;
                padding: 25px;
                display: flex;
                flex-direction: column;
                transform: translateY(100%);
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
            }
            .overlay-history.open {
                transform: translateY(0);
            }
            .history-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.08); 
                padding-bottom: 12px;
                margin-bottom: 15px;
            }
            .history-header h3 {
                margin: 0;
                color: #fff;
                font-size: 1.1rem;
                font-weight: 500;
            }
            .close-btn {
                background: none;
                border: none;
                color: #abb2bf;
                font-size: 0.9rem;
                cursor: pointer;
            }
            .close-btn:hover { color: #f44336; }
            
            .history-list { 
                flex-grow: 1; 
                overflow-y: auto; 
                list-style: none; 
                padding: 0; 
                margin: 0; 
            }
            .history-list li { 
                padding: 12px 5px; 
                border-bottom: 1px solid rgba(255, 255, 255, 0.03); 
                font-size: 0.95rem; 
                color: #5c6370; 
                cursor: pointer; 
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .history-list li:hover { color: #2196f3; }
            .history-list li .expr { font-size: 0.85rem; opacity: 0.7; }
            .history-list li .ans { font-size: 1.1rem; color: #abb2bf; font-weight: 500; }
            .history-list li:hover .ans { color: #2196f3; }
            .history-list::-webkit-scrollbar { width: 4px; }
            .history-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        </style>
    </head>
    <body>
        <div class="calculator-card">
            <div class="header-actions">
                <button class="history-toggle-btn" onclick="toggleHistory(true)" title="View History">🕒</button>
            </div>

            <input type="text" id="display" readonly placeholder="0">
            
            <div class="grid">
                <button class="calc-btn clear" onclick="clearDisplay()">C</button>
                <button class="calc-btn" onclick="appendValue('(')">(</button>
                <button class="calc-btn" onclick="appendValue(')')">)</button>
                <button class="calc-btn operator" onclick="appendValue('/')">÷</button>
                
                <button class="calc-btn" onclick="appendValue('7')">7</button>
                <button class="calc-btn" onclick="appendValue('8')">8</button>
                <button class="calc-btn" onclick="appendValue('9')">9</button>
                <button class="calc-btn operator" onclick="appendValue('*')">×</button>
                
                <button class="calc-btn" onclick="appendValue('4')">4</button>
                <button class="calc-btn" onclick="appendValue('5')">5</button>
                <button class="calc-btn" onclick="appendValue('6')">6</button>
                <button class="calc-btn operator" onclick="appendValue('-')">-</button>
                
                <button class="calc-btn" onclick="appendValue('1')">1</button>
                <button class="calc-btn" onclick="appendValue('2')">2</button>
                <button class="calc-btn" onclick="appendValue('3')">3</button>
                <button class="calc-btn operator" onclick="appendValue('+')">+</button>
                
                <button class="calc-btn" onclick="appendValue('0')">0</button>
                <button class="calc-btn" onclick="appendValue('.')">.</button>
                <button class="calc-btn equal" onclick="calculateResult()">=</button>
            </div>

            <div id="historyOverlay" class="overlay-history">
                <div class="history-header">
                    <h3>Calculation History</h3>
                    <button class="close-btn" onclick="toggleHistory(false)">Close</button>
                </div>
                <ul id="historyList" class="history-list"></ul>
            </div>
        </div>

        <script>
            const display = document.getElementById('display');
            const historyOverlay = document.getElementById('historyOverlay');

            function appendValue(val) {
                if (display.value === '0' && !isNaN(val)) display.value = '';
                display.value += val;
            }

            function clearDisplay() {
                display.value = '';
            }

            function toggleHistory(open) {
                if (open) {
                    loadHistory();
                    historyOverlay.classList.add('open');
                } else {
                    historyOverlay.classList.remove('open');
                }
            }

            async function calculateResult() {
                const expr = display.value;
                if (!expr) return;

                try {
                    const response = await fetch('/api/compute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ expression: expr })
                    });
                    const data = await response.json();

                    if (data.success) {
                        display.value = data.result;
                    } else {
                        display.value = data.error;
                    }
                } catch (err) {
                    display.value = "Error";
                }
            }

            async function loadHistory() {
                try {
                    const response = await fetch('/api/history');
                    const data = await response.json();
                    const list = document.getElementById('historyList');
                    list.innerHTML = '';

                    if (data.success && data.history.length > 0) {
                        data.history.forEach(row => {
                            const li = document.createElement('li');
                            li.innerHTML = \`<span class="expr">\${row.expression} =</span><span class="ans">\${row.evaluation_ans}</span>\`;
                            li.onclick = () => { 
                                display.value = row.expression; 
                                toggleHistory(false); // Close panel after picking equation
                            };
                            list.appendChild(li);
                        });
                    } else {
                        list.innerHTML = '<li style="border:none;color:#5c6370;opacity:0.6;text-align:center;margin-top:20px;">No history records</li>';
                    }
                } catch (err) {
                    console.error("Error loading history logs.");
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});