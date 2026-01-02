const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "blackjack",
  version: "1.3.0",
  hasPermssion: 0,
  credits: "Vanloi",
  description: "zidach", chia bài từng lá với hit/stand",
  commandCategory: "Trò Chơi",
  usages: "blackjack <số tiền>",
  cooldowns: 10
};

let games = {};

function shuffleDeck() {
  const suits = ["S","H","D","C"];
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  let deck = [];
  for(let s of suits) for(let v of values) deck.push({value:v,suit:s});
  return deck.sort(()=>Math.random()-0.5);
}

function getCardValue(card){
  if(["J","Q","K"].includes(card.value)) return 10;
  if(card.value==="A") return 11;
  return parseInt(card.value);
}

function handValue(hand){
  let total=hand.reduce((sum,c)=>sum+getCardValue(c),0);
  let aces=hand.filter(c=>c.value==="A").length;
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}

function handString(hand){
  return hand.map(c=>`${c.value}${c.suit}`).join(" ");
}

function getCardImage(card){
  const valueMap={A:"ace",J:"jack",Q:"queen",K:"king"};
  const suitMap={S:"spades",H:"hearts",D:"diamonds",C:"clubs"};
  let value=valueMap[card.value]||card.value;
  if(["J","Q","K"].includes(card.value)) value+="_2";
  let suit=suitMap[card.suit];
  return path.join(__dirname,"modules","commands","game","poker",`${value}_of_${suit}.png`);
}

function handImages(hand, hideFirst=false){
  return hand.map((c,i)=>{
    if(i===0 && hideFirst) return fs.createReadStream(path.join(__dirname,"modules","commands","game","poker","back.png"));
    const p=getCardImage(c);
    return fs.existsSync(p)?fs.createReadStream(p):null;
  }).filter(Boolean);
}

// Delay helper
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

// START
module.exports.run=async function({event,api,Currencies,args}){
  try{
    const {threadID,messageID,senderID}=event;
    const money=(await Currencies.getData(senderID)).money;
    const bet=parseInt(args[0]==="all"?money:args[0]);
    if(!bet||isNaN(bet)||bet<1000) return api.sendMessage("❌ Tiền cược phải từ 1000 trở lên",threadID,messageID);
    if(bet>money) return api.sendMessage("❌ Bạn không đủ tiền để cược",threadID,messageID);
    if(games[senderID]) return api.sendMessage("⚠️ Bạn đang có ván Blackjack chưa kết thúc, reply 'hit' hoặc 'stand'.",threadID,messageID);

    let deck=shuffleDeck();
    let playerHand=[], dealerHand=[];

    games[senderID]={deck,playerHand,dealerHand,bet};

    // Chia bài từng lá
    for(let i=0;i<2;i++){
      playerHand.push(deck.pop());
      dealerHand.push(deck.pop());
      await api.sendMessage({
        body:`🃏 Chia bài...\n[🎯] Bài bạn: ${handString(playerHand)}\n[🃏] Dealer: 1 lá ẩn + ${handString([dealerHand[1]])}`,
        attachment:handImages(playerHand,true)
      },threadID,messageID);
      await sleep(1000);
    }

    const msg=`🃏 BLACKJACK 🃏
[🎯] Bài của bạn (Tổng: ${handValue(playerHand)}):
[🃏] Dealer: 1 lá ẩn + ${handString([dealerHand[1]])}
[💵] Cược: ${bet}$
Reply "hit" để rút thêm, "stand" để dừng.`;

    return api.sendMessage({body:msg,attachment:handImages(playerHand,true)},threadID,messageID);

  }catch(e){console.error(e); api.sendMessage("❌ Đã xảy ra lỗi",event.threadID,event.messageID);}
};

// REPLY
module.exports.handleReply=async function({event,api,Currencies}){
  const {senderID,body,threadID,messageID}=event;
  if(!games[senderID]) return;
  const game=games[senderID];
  let {deck,playerHand,dealerHand,bet}=game;
  const {increaseMoney,decreaseMoney}=Currencies;
  const action=body.toLowerCase();

  if(action==="hit"){
    playerHand.push(deck.pop());
    const total=handValue(playerHand);
    if(total>21){
      decreaseMoney(senderID,bet);
      delete games[senderID];
      return api.sendMessage({body:`💥 Bạn bốc bài: ${handString(playerHand)} (Tổng: ${total})\n❌ BUST! Bạn thua ${bet}$`,attachment:handImages(playerHand)},threadID,messageID);
    }else{
      return api.sendMessage({body:`🃏 Bài của bạn: ${handString(playerHand)} (Tổng: ${total})\nReply "hit" để rút thêm, "stand" để dừng.`,attachment:handImages(playerHand)},threadID,messageID);
    }

  }else if(action==="stand"){
    // Dealer lật lá ẩn và bốc tiếp
    while(handValue(dealerHand)<17) dealerHand.push(deck.pop());
    const playerTotal=handValue(playerHand);
    const dealerTotal=handValue(dealerHand);
    let result,moneyChange;

    if(dealerTotal>21 || playerTotal>dealerTotal){ result="Thắng"; moneyChange=bet; increaseMoney(senderID,bet);}
    else if(playerTotal<dealerTotal){ result="Thua"; moneyChange=-bet; decreaseMoney(senderID,bet);}
    else{ result="Hòa"; moneyChange=0;}

    delete games[senderID];

    return api.sendMessage({
      body:`🃏 KẾT QUẢ BLACKJACK 🃏
[🎯] Bài bạn: ${handString(playerHand)} (Tổng: ${playerTotal})
[🃏] Bài dealer: ${handString(dealerHand)} (Tổng: ${dealerTotal})
[💵] Cược: ${bet}$
[📊] Kết quả: ${result}
[💰] Thay đổi tiền: ${moneyChange>0?"+":""}${moneyChange}$`,
      attachment:[...handImages(playerHand),...handImages(dealerHand)]
    },threadID,messageID);

  }else{
    return api.sendMessage("⚠️ Reply không hợp lệ, chỉ có 'hit' hoặc 'stand'",threadID,messageID);
  }
};
