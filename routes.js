const express = require('express');
const router = express.Router();
const Product = require('./models/product');
const User = require('./models/users');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './assets/uploads'); // Change the destination folder as needed
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });



router.get('/', (req, res) => {
    res.send('Welcome to the home page');
});
// POST route for user login
router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Find the user by email
      const user = await User.findOne({ email });
  
      // If the user is not found, return an error
      if (!user) {
        return res.status(200).json({success:false, message: 'User not found' });
      }
  
      // Compare the provided password with the hashed password in the database
      const passwordMatch = await bcrypt.compare(password, user.password);
  
      // If passwords don't match, return an error
      if (!passwordMatch) {
        return res.status(200).json({success:false, message: 'Invalid password'});
      }
  
      // If everything is fine, you can generate a token or set a session, etc.
      // For simplicity, let's just send a success message
      res.status(200).json({ success:true, message: 'Login successful', userid: user._id  });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});
// add a product
router.post('/addProduct', upload.single('productpic'), async (req, res) => {
    try {

      const imagePath = req.file.path;      
      const newProduct = new Product({
        name: req.body.productname,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        brand: req.body.brand,
        stockQuantity: req.body.quantity,      
        images: [imagePath],
      });
  
      const savedProduct = await newProduct.save();
  
      res.status(200).json({success:true,message:"Product added successfully"});
    } catch (error) {
      console.error(error);
      res.status(201).json({success:false,message:"Server Error"});
    }
  });

  // Route to add a new user
router.post('/addUser', async (req, res) => {
    try {
      // Extract user data from the request body
      const { firstname, lastname, phone, address, email, password, supplier, staff } = req.body;
  
      // Check if the user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(200).json({ success:false, message: 'User already exists' });
      }
  
      // Encrypt the password using bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new user instance
      const newUser = new User({
        firstname,
        lastname,
        phone,
        address,
        email,
        password: hashedPassword,
        supplier,
        staff
      });
  
      // Save the user to the database
      await newUser.save();
  
      return res.status(201).json({success: true, message: 'User added successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({success:false, message: 'Internal Server Error' });
    }
  });

  router.get('/getUser/:id', async(req, res)=>{
    try{
      const user = await User.findOne({_id: req.params.id});
      if(user){
        res.status(200).json({success:true, message: "User exists", data: user})
      }else{
        res.status(200).json({success:false, message: "User not found"})
      }

    }catch(e){
      res.status(500).json({success:false, message: e})

    }
    
  })

module.exports = router;
  