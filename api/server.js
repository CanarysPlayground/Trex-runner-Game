const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());

let highScore = 0;

app.get('/score', (req,res)=>res.json({highScore}));

app.post('/score/:value', (req,res)=>{
  const val = Number(req.params.value);
  if(val > highScore) highScore = val;
  res.json({highScore});
});

if (require.main === module) {
  app.listen(3000, ()=>console.log('API running on 3000'));
}

module.exports = { app, reset: () => { highScore = 0; } };
