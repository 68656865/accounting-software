const mongoose=require('mongoose');
console.log('connecting.......');
mongoose.connect('mongodb+srv://shuhaib123:mspp6865@cluster1.0twlq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1')
.then(()=>console.log('Connected to MongoDB'))
.catch((err) => console.error('could not connect to MongoDB',err));





module.exports = mongoose;