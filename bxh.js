const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createCanvas, registerFont } = require("canvas");

module.exports.config = {
    name: "bxh",
    version: "3.7.0",
    credits: "Vanloi",
    hasPermssion: 0,
    description: "BXH câu cá",
    usages: "bxh",
    commandCategory: "Trò Chơi",
    cooldowns: 5
};

const rarityOrder = ["common","uncommon","rare","epic","legendary","mythical","divine","secret"];

module.exports.run = async function({ api, event, Users }) {
    const { threadID, senderID } = event;

    const dbPath = path.join(__dirname, "data.sqlite");
    if (!fs.existsSync(dbPath)) return api.sendMessage("❌ Không tìm thấy database", threadID);

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return api.sendMessage("❌ Không thể mở database: " + err.message, threadID);
    });

    db.all("SELECT * FROM Users", [], async (err, rows) => {
        if (err) {
            db.close();
            return api.sendMessage("❌ Lỗi truy vấn database: " + err.message, threadID);
        }

        let users = [];

        // --- Lấy dữ liệu user, chỉ lấy những user có name ---
        for (let user of rows) {
            let data = null;
            if (typeof user.data === "string") {
                try { data = JSON.parse(user.data); } catch(e){ data = null; }
            } else if (user.data && typeof user.data === "object") {
                data = user.data;
            }
            if (!data) continue;

            let userInfo;
            try {
                userInfo = await Users.getData(user.userID);
            } catch(e){ continue; }

            if (!userInfo || !userInfo.name) continue; // bỏ user không có name

            const name = userInfo.name;
            const fishList = Array.isArray(data.fishHistory) && data.fishHistory.length > 0
              ? data.fishHistory
              : Array.isArray(data.fishInventory)
                ? data.fishInventory
                : [];
            const totalFish = fishList.length || data.fishCount || 0;
            const totalFishMoney = fishList.length > 0
              ? fishList.reduce((sum, f) => sum + (f.price || 0), 0)
              : 0;
            const rareFish = fishList.length > 0
              ? fishList.reduce((prev, curr) => {
                  return rarityOrder.indexOf(curr.rarity) > rarityOrder.indexOf(prev.rarity || "common") ? curr : prev;
                }, {})
              : null;

            users.push({ id: user.userID, name, totalFish, totalFishMoney, rareFish });
        }

        try {
            if(!fs.existsSync(__dirname+'/cache')) fs.mkdirSync(__dirname+'/cache');
            if(!fs.existsSync(__dirname+'/cache/SplineSans-Medium.ttf')) { 
                let getfont = (await axios.get(`https://drive.google.com/u/0/uc?id=102B8O3_0vTn_zla13wzSzMa-vdTZOCmp&export=download`, { responseType: "arraybuffer" })).data;
                fs.writeFileSync(__dirname+"/cache/SplineSans-Medium.ttf", Buffer.from(getfont, "utf-8"));
            };
            registerFont(__dirname+`/cache/SplineSans-Medium.ttf`, { family: "SplineSans-Medium" });

            const canvas = createCanvas(1600, 600); // canvas ngang
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#f0f8ff";
            ctx.fillRect(0,0,canvas.width,canvas.height);

            const colWidth = canvas.width / 3;
            const startX = [colWidth/2, colWidth + colWidth/2, 2*colWidth + colWidth/2];

            // --- Dữ liệu BXH ---
            const bxhData = [
                {
                    title: "TOP MONEY",
                    users: [...users].sort((a,b)=>b.totalFishMoney - a.totalFishMoney),
                    valueFunc: e => e.totalFishMoney.toLocaleString()+"$"
                },
                {
                    title: "TOP SỐ CÁ",
                    users: [...users].sort((a,b)=>b.totalFish - a.totalFish),
                    valueFunc: e => e.totalFish + " cá"
                },
                {
                    title: "TOP CÁ MẮC NHẤT",
                    users: [...users].sort((a,b)=>{
                        const aR = a.rareFish ? rarityOrder.indexOf(a.rareFish.rarity) : -1;
                        const bR = b.rareFish ? rarityOrder.indexOf(b.rareFish.rarity) : -1;
                        return bR - aR;
                    }),
                    valueFunc: e => e.rareFish ? `${e.rareFish.name} (${e.rareFish.rarity})` : ""
                }
            ];

            // --- Vẽ 3 BXH ---
            for (let i=0;i<3;i++){
                const x = startX[i];
                let y = 60;
                const bxh = bxhData[i];

                ctx.fillStyle = "#000";
                ctx.font = "40px SplineSans-Medium";
                ctx.textAlign = "center";
                ctx.fillText(bxh.title, x, y);
                y += 50;

                const topUsers = bxh.users.slice(0,10);
                for (let j=0;j<topUsers.length;j++){
                    const e = topUsers[j];
                    ctx.font = "30px SplineSans-Medium";
                    ctx.fillStyle = e.id === senderID ? "#ff0000" : "#000";
                    const text = e.name + " → " + bxh.valueFunc(e);
                    ctx.fillText(`${j+1}. ${text}`, x, y);
                    y += 35;
                }

                const senderPos = bxh.users.findIndex(u=>u.id===senderID);
                if(senderPos>=10 && bxh.valueFunc(bxh.users[senderPos])) {
                    ctx.fillStyle = "#ff0000";
                    ctx.fillText(`→ Bạn ở vị trí ${senderPos+1}: ${bxh.valueFunc(bxh.users[senderPos])}`, x, y);
                }
            }

            const imagePath = __dirname + "/cache/bxh_canvas.png";
            fs.writeFileSync(imagePath, canvas.toBuffer());
            await api.sendMessage({ body: "🏆 BXH TOÀN SERVER 🏆", attachment: fs.createReadStream(imagePath) }, threadID);
            fs.unlinkSync(imagePath);
        } catch(e){
            console.log("Lỗi canvas:", e);
            api.sendMessage("❌ Lỗi tạo canvas BXH", threadID);
        }

        db.close();
    });
};
