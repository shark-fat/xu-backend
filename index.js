const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "supersecretkey";

app.use(cors());
app.use(express.json());

// ✅ Route test root để tránh lỗi Cannot GET /
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// ✅ Admin account
let users = {
  "ADMIN": {
    password: "KIEMXU123",
    xu: 0,
    role: "admin",
    history: []
  }
};

let pendingRedeems = [];

// ✅ Admin login (JWT token)
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== password || user.role !== "admin") {
    return res.status(403).json({ error: "Sai tài khoản hoặc mật khẩu" });
  }
  const token = jwt.sign({ username, role: "admin" }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

// ✅ Middleware xác thực token
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Thiếu token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Không phải admin" });
    next();
  } catch {
    return res.status(403).json({ error: "Token không hợp lệ" });
  }
}

// ✅ CPAlead postback
app.get("/cpalead-callback", (req, res) => {
  const username = req.query.subid;
  if (!username) return res.status(400).send("Thiếu subid");

  if (!users[username]) users[username] = { xu: 0, history: [] };
  users[username].xu += 1000;
  users[username].history.push({
    task: "CPAlead Offer",
    status: "đã hoàn thành",
    time: new Date().toLocaleString()
  });

  res.send("OK");
});

// ✅ Rút xu
app.post("/api/redeem", (req, res) => {
  const { username, method, amount, ...details } = req.body;
  const today = new Date().toDateString();

  if (!username || !method || !amount) return res.status(400).json({ error: "Thiếu dữ liệu" });
  if (!users[username]) return res.status(404).json({ error: "Không tìm thấy user" });
  if (users[username].lastRedeemDate === today) return res.status(403).json({ error: "Đã rút hôm nay" });
  if (users[username].xu < amount) return res.status(400).json({ error: "Không đủ xu" });

  users[username].xu -= amount;
  users[username].lastRedeemDate = today;
  users[username].history = users[username].history || [];
  users[username].history.push({
    task: `Rút ${amount} xu (${method})`,
    status: "đang xử lý",
    time: new Date().toLocaleString()
  });

  pendingRedeems.push({
    username,
    method,
    amount,
    details,
    time: new Date().toLocaleString()
  });

  res.json({ message: "Gửi yêu cầu thành công", xu: users[username].xu });
});

// ✅ API cho admin
app.get("/api/pending-redeems", verifyAdmin, (req, res) => res.json(pendingRedeems));

app.post("/api/complete-redeem", verifyAdmin, (req, res) => {
  const { username, time } = req.body;
  const user = users[username];
  if (user && user.history) {
    const h = user.history.find(h => h.task.startsWith("Rút") && h.time === time);
    if (h) h.status = "đã hoàn thành";
  }
  pendingRedeems = pendingRedeems.filter(r => r.username !== username || r.time !== time);
  res.json({ message: "Đã xử lý" });
});

// ✅ Thống kê & leaderboard
app.get("/api/user/:username", (req, res) => {
  const user = users[req.params.username];
  if (!user) return res.status(404).json({ error: "Không tồn tại" });
  res.json(user);
});

app.get("/api/stats", (req, res) => {
  const totalUsers = Object.keys(users).length;
  const totalXu = Object.values(users).reduce((sum, u) => sum + (u.xu || 0), 0);
  res.json({ totalUsers, totalXu });
});

app.get("/api/leaderboard", (req, res) => {
  const top = Object.entries(users)
    .map(([username, data]) => ({ username, xu: data.xu || 0 }))
    .sort((a, b) => b.xu - a.xu)
    .slice(0, 10);
  res.json(top);
});

app.listen(PORT, () => {
  console.log("✅ Backend chạy tại http://localhost:" + PORT);
});
