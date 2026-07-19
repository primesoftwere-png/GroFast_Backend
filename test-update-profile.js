const mongoose = require('mongoose');
const dotenv = require('dotenv');
const userModel = require('./models/user.model');

dotenv.config();

async function testUpdate() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const userId = "6a13132550206314fe5e252f"; // The ID from user's output
  
  const user = await userModel.findById(userId);
  if (!user) {
    console.log("User not found!");
    process.exit(1);
  }
  console.log("Before update:", user.profileImage);

  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    { profileImage: "https://ui-avatars.com/api/?name=Shrey+Ponkiya" },
    { new: true }
  );
  console.log("After update:", updatedUser.profileImage);
  
  process.exit(0);
}

testUpdate().catch(console.error);
