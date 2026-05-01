const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const URI = 'mongodb+srv://varadsingh0225_db_user:xBUVK953ae3Hnn3d@cluster0.0c0svac.mongodb.net/couples_call?retryWrites=true&w=majority&appName=Cluster0';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: null },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

mongoose.connect(URI).then(async () => {
  try {
    const username = "vxrad";
    const password = "password123"; // just testing what happens
    console.log("Finding user...");
    const user = await User.findOne({ username });
    console.log("User found:", user ? "yes" : "no");
    if (user) {
       console.log("Comparing password...");
       const match = await bcrypt.compare(password, user.password);
       console.log("Match:", match);
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit();
});
