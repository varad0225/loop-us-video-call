const mongoose = require('mongoose');
const URI = 'mongodb+srv://varadsingh0225_db_user:xBUVK953ae3Hnn3d@cluster0.0c0svac.mongodb.net/couples_call?retryWrites=true&w=majority&appName=Cluster0';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

mongoose.connect(URI).then(async () => {
  const reqUserId = "69f44276780a7b05d8b9f0e5"; // semi1
  const username = "vx"; // searching for vxrad
  try {
    const users = await User.find({ 
        username: { $regex: username, $options: 'i' },
        _id: { $ne: reqUserId }
    }).select('_id name username').limit(5);
    console.log("Search result:", users);
  } catch (err) {
    console.error(err);
  }
  process.exit();
});
