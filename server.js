

const TelegramBot = require('node-telegram-bot-api');
const WebAppUrl ="https://vocal-clafoutis-0f197b.netlify.app/"
const token = '6037873883:AAE7uHSgYV7Y3yL1T6IPdYr6O31Eqe8eu1I'

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});
let userName =" "
// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text =msg.text
    if(text === "/start"){
        bot.sendMessage(chatId, 'Lobby created, send this message to connect',{
            reply_markup:{
                inline_keyboard: [
                    [{text: "Join game", web_app: {url: WebAppUrl}}]
                ]
            }
        });
    }
    userName=msg.chat.first_name

});




const express = require('express');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server,{
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});


const {weaponSkills} = require('./db');
const {monsters} = require('./db');
const {weapons} = require('./db');


const cors =require('cors')

let team=[]
let teamHP=[]

let monster
let MonsterCurrentHp
let EndTurn =[]
let activePlayers=[]
let monsterList=[]
let i=0
let monsterCounter=0
let Messages = []
let isStunned = false
let isBleeding = false
let bleedCounter = 0
let bleedDamage = 0
let deadPlayersCounter = 0
app.use(cors({origin: 'http://localhost:3000'}));
app.use(express.json())

function onDisconnect(id){
    activePlayers.splice(id,1)
}
function onRestart(){
    team=[]
    teamHP=[]
    EndTurn =[]
    activePlayers=[]
    monsterList=[]
    i=0
    monsterCounter=0
    deadPlayersCounter = 0
    Messages = []
}
io.on('connection', (socket) =>{

    socket.on("RESTART", (data) =>{
        onRestart()
        io.emit("RESTART")
    })

   socket.on("WEAPON SUBMITTED", (data) =>{
       team.push({...weapons[data.IdOfWeapon], id:i, socketId:socket.id,userName:userName})
       activePlayers.push(i)
       i++
       teamHP.push(team[team.length-1].hp)

       io.emit("WEAPON SUBMITTED", {
        team, teamHP
       })

   })
    socket.on("PLAYER DAMAGED", (data) =>{
        teamHP[data.playerId]=data.currentHp
        io.emit("PLAYER DAMAGED", {
            teamHP
        })

    })
    socket.on("PLAYER HEAL", (data) =>{
        teamHP[data.playerId]+=data.heal
        if( teamHP[data.playerId]> team[data.playerId].maxhp) {
            teamHP[data.playerId]=team[data.playerId].maxhp
        }
        io.emit("PLAYER DAMAGED", {
            teamHP
        })
    })
    socket.on("EVERYONE STATUP SKILL", (data) =>{
        let everyoneid=data.everyoneID
        io.emit("EVERYONE STATUP", {
            everyoneid:everyoneid
        })

    })

    socket.on("MONSTER STATE", (data) =>{
        isStunned=data.isStunned
        isBleeding=data.isBleeding
        bleedCounter=data.bleedCounter
        bleedDamage=data.bleedDmg
        io.emit("MONSTER STATE", {
            isStunned:isStunned,
            isBleeding:isBleeding
        })

    })
    socket.on("SKILL USED", (data) =>{
        if(data.currentHp===9999){
            for(let i=0;i<10;i++){
                monsterList.push(monsters[Math.floor(Math.random()*monsters.length)])
                monsterList[i].maxhp=monsterList[i].maxhp*team.length
            }
            monsterList.sort((x, y) => x.lvl - y.lvl);

            monster=monsterList[0]
            MonsterCurrentHp=monster.maxhp
            }

        if(data.currentHp!=9999&&MonsterCurrentHp>=0) {
            MonsterCurrentHp = data.currentHp
            EndTurn.push(data.isActive)

            if(EndTurn.length===activePlayers.length){
                EndTurn=[]
                let damagedPlayer = activePlayers[Math.floor(Math.random()*activePlayers.length)]


                io.emit("MONSTER ATTACKS", {
                    hitRandomizer1: Math.random(),
                    hitRandomizer2: Math.random(),
                    damagedPlayer: damagedPlayer,
                    isStunned: isStunned
                })
            if(isStunned){
                Messages.unshift(monster.name+" recovers from stun")
                isStunned=false
            }
                if(isBleeding){
                    MonsterCurrentHp = MonsterCurrentHp-bleedDamage
                    io.emit("SKILL USED", {
                        MonsterCurrentHp: MonsterCurrentHp
                    })
                    Messages.unshift(monster.name+" takes "+bleedDamage+" DMG from bleed")
                    bleedCounter--
                    if(bleedCounter<=0){
                        isBleeding=false
                    }
                }

            }

        }

        if(MonsterCurrentHp<=0){
            monsterCounter++
            if (monsterCounter>=11){
                io.emit("GAME END", {
                        isVictory: true
                })

            }
            monster= monsterList[monsterCounter]
            MonsterCurrentHp=monster.maxhp
            bleedCounter = 0
            bleedDamage = 0
            isBleeding=false
            isStunned=false
                io.emit("MONSTER DEAD")

        }
        io.emit("SKILL USED", {
            finalDmg: data.finalDmg,
            Message:data.Message,
            maxhp:monster.maxhp,
            hp:MonsterCurrentHp,
            name:monster.name,
            img:monster.img,
            spd:monster.spd,
            arm:monster.arm,
            crt:monster.crt,
            dmg:monster.dmg
        })


    })
    socket.on("CHANGE MESSAGES", (data) =>{
        if(Messages.length>3){
            Messages.splice(3)
        }
        Messages.unshift(data.Message)

        io.emit("CHANGE MESSAGES", {
            Messages
        })
    })
    socket.on("PLAYER DEAD", (data) =>{
            onDisconnect(data.playerId)
            deadPlayersCounter++
                if(deadPlayersCounter>=teamHP.length){
                    io.emit("GAME END", {
                        isVictory: false
                    })
                    onRestart()
                }
    })
    console.log('user connected', socket.id)

})

server.listen(8000, () => {
    console.log('listening on 8000');
});
app.get('/team', (req,res) => {
    res.json({team})
})
app.get('/skilllist', (req,res) =>{
    res.json({weaponSkills})
})
app.get('/monsterlist', (req,res) =>{
    res.json({monsterList})
})
app.get('/weapons', (req,res) =>{
    res.json({weapons})
})
