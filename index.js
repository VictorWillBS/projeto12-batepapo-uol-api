import cors from "cors"
import chalk from "chalk"
import dotenv from "dotenv"
import express, {json}from "express"
import { MongoClient } from "mongodb"

const mongodb = new MongoClient(process.env.ROTA_DO_MONGO)
let db;

const app = express()
app.use(cors)
app.use(json)

dotenv.config();


app.listen(5000,()=>{
    console.log(chalk.green("rodando servidor"))
})