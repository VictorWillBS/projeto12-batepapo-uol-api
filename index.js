import cors from "cors"
import chalk from "chalk"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from 'dayjs'
import express, {json}from "express"
import { MongoClient } from "mongodb"

dotenv.config();

const app = express()
app.use(cors())
app.use(json())
const mongoClient = new MongoClient(process.env.ROTA_DO_MONGO)
let db;

async function conectar_Mongo(){
    await mongoClient.connect()
    db = mongoClient.db("driven")
    console.log("Mongo Conectado...")
    agendarRemocaoUser()
}
conectar_Mongo()

function desconectar_Mongo(){
    mongoClient.close()
    console.log("desconectando")
}

function validacaoSchemas(schema, toValid){
    
    const validacao = schema.validate(toValid);
    return validacao.error
}

//Participants Route
const participantSchema = joi.object({
    name:joi.string().required()
})

async function inserirMensagemdeEntrada(name,action){
    const time =dayjs().format('HH:mm:ss');
    const mensagemEntrada = {
        from:name,
        to:"Todos",
        text:`${action} na sala...`,
        type:"status",
        time,
    };
    await db.collection("messages").insertOne({mensagemEntrada})

}

app.post('/participants',async (req,res)=>{
    const nameObj = req.body
    const {name} = nameObj
    if(validacaoSchemas(participantSchema, nameObj)){
        res.sendStatus(422)
        return
    }
    
    try{
        const jaExisteNome= await db.collection("users").findOne({name:name})
        if(jaExisteNome){
            res.sendStatus(409)
            return
        }

        inserirMensagemdeEntrada(name,"Entra")

        await db.collection("users").insertOne({name,lastStatus:Date.now()})
        res.send(201)
        

    }catch(error){
        res.status(500).send("Deu ruim ")
        
    }
})

app.get('/participants',async (req,res)=>{
    const usersList = await db.collection("users").find().toArray()
    res.send(usersList)
})

//Message Route
const messageSchema = joi.object({
    to: joi.string().required(),
    type: joi.alternatives().allow("message", "private_message"),
    text: joi.string().required(),
    from: joi.string().required(),
    time: joi.string()
})

app.post('/messages', async (req,res)=>{
    
    const time =dayjs().format('HH:mm:ss');
    const {to,type,text} = req.body;
    const {from} = req.headers;
    const message = {
        to,
        type,
        text,
        from,
        time
    }

    const arrayMesmosNomes = await db.collection("users").find({"name":from}).toArray()
    if(!(arrayMesmosNomes.length)){
        
        res.sendStatus(422)
        return
    }
    
    if(validacaoSchemas(messageSchema,message)){
       
        res.status(422).send(validacaoSchemas(messageSchema,message))
        return
    }
    try {
        await db.collection("messages").insertOne({...message})
        res.sendStatus(201);
        
    } catch (error) {
        res.sendStatus(500)
    }
})

app.get('/messages', async(req,res)=>{
    const {limit} =req.query
    const {user}= req.headers
    const userMessages= []
    const messagesData= await db.collection("messages").find().toArray()
    messagesData.map((message)=>{
        const{to,type} = message
        if(to === user){
            userMessages.push(message)
            return
        }if(type === "message"){
            userMessages.push(message)
        }
    })
    let lastMessages; 
    if(limit>0){
        lastMessages = userMessages.reverse().slice(0,limit)
    }else{
        lastMessages = userMessages.reverse()
    }
    
    res.status(200).send(lastMessages)
})

//Status Route
app.post('/status', async(req,res)=>{
    const {user}=req.headers;
    const updateUser = {
        user: user,
        time:Date.now()
    }
    const userExiste = await db.collection("users").find({"name":user})
    if(!userExiste){
        res.status(404).send("deu ruim fml")
        return
    }
    try {
        const inserirUser= await db.collection("user-Status").insertOne({...updateUser})
        res.status(200).send(updateUser)
    } catch (error) {
        res.status(500).send("deu ruim familia")   
    }
})

async function deletarUsuario(usuario){
    
    const deletarUser = await db.collection('users').deleteMany({"name": usuario});
    
}

function enviarMensagemSaida(usuariosParaRemocao){
    const arrUsuarioSemRepeticao = [...new Set(usuariosParaRemocao)];
    arrUsuarioSemRepeticao.map(async(usuario)=>{
        inserirMensagemdeEntrada(usuario,"Sai")
        deletarUsuario(usuario)
    })
    
}

async function removerUser(){
    const timeNow = Date.now();
    const dezSeg= 10* 1000;
    const timeLimite=timeNow-dezSeg;
    const statusAll= await db.collection('user-Status').find({"time": {$lt:timeLimite}}).toArray()
    const usuariosParaRemocao = []

    statusAll.map((usuario)=>usuariosParaRemocao.push(usuario.user))
    enviarMensagemSaida(usuariosParaRemocao)

    const deletarStatus = await db.collection('user-Status').deleteMany({"time": {$lt:timeLimite}})
    
    
   
}

function agendarRemocaoUser(){
    console.log("Remoção em 15 segundos...")
    setInterval(removerUser,15000)
}


app.listen(process.env.PORT,()=>{
    console.log(chalk.green("Rodando servidor 13..."))
})