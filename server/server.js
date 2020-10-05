import express from 'express'
import path from 'path'
import axios from 'axios'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { readFile, writeFile, unlink } = require("fs").promises


const Root = () => ''

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const headers = (req, res, next) => {
  res.set('x-skillcrucial-user', '7e6c249a-9f98-4872-a8aa-a158a2515083');  
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')  
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  headers
]

middleware.forEach((it) => server.use(it))

const fileRead = () => {
  const data = readFile(`${__dirname}/users.json`, { encoding: 'utf8'})
  .then((text) => JSON.parse(text))
  .catch(async () => {
   const {data: users} = await axios('https://jsonplaceholder.typicode.com/users')
   writeFile(`${__dirname}/users.json`, JSON.stringify(users) , { encoding: 'utf8'})
   readFile(`${__dirname}/users.json`, { encoding: 'utf8'})
    .then((text) => JSON.parse(text))
  })
  return data
}

server.get('/api/v1/users', async (req, res) => {
  const users = await fileRead()
  res.json(users)
})


// post /api/v1/users - добавляет юзера в файл users.json, с id равным id последнего элемента + 1 
// и возвращает { status: 'success', id: id }

server.post('/api/v1/users', async (req, res) => {
  const users = await fileRead()
  const newUser = req.body
  newUser.id = users[users.length - 1].id +1
  writeFile(`${__dirname}/users.json`, JSON.stringify([...users, newUser]), { encoding: 'utf8'})
  res.json({ status: 'success', id: newUser.id})
})

// patch /api/v1/users/:userId - получает новый объект, дополняет его полями юзера в users.json, с id равным userId,
//  и возвращает { status: 'success', id: userId }

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const newUser = req.body
  const users = await fileRead()
  const arr = users.find((it) => it.id === +userId)
  const newData = {...arr, ...newUser}
  writeFile(`${__dirname}/users.json`, JSON.stringify(newData), { encoding: 'utf8'})
  res.json({ status: 'success', id: userId})
})

// delete /api/v1/users/:userId - удаляет юзера в users.json, с id равным userId, и возвращает { status: 'success', id: userId }

server.delete('/api/v1/users/:userId', async (req, res) => {
 const { userId } = req.params
 const users = await fileRead()
 const arr = users.filter((it) => it.id !== +userId)
 writeFile(`${__dirname}/users.json`, JSON.stringify(arr), { encoding: 'utf8'})
 res.json({ status: 'success', id: userId})
})

// delete /api/v1/users - удаляет файл users.json

server.delete('/api/v1/users', async (req, res) => {
  unlink(`${__dirname}/test.json`)
  res.json({ status: 'success' })
})


server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
