const express = require('express');
const router = express.Router();
const Product = require('./models/product');
const User = require('./models/users');
const Cart = require('./models/cart');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const fs = require('fs');
const Transaction = require('./models/transactions');
const SystemBalance = require('./models/sysBalances');
const MasterService = require('./services/productServices');
const masterService = new MasterService();


const azure_storage_account = "3acsimagestorage"
const azure_storage_account_key = "IgeI3y8i8SdWvjW1zUpbkwU3W7tfaTmSSDRfCeji01gmeIm8+Th9jL74RZ4kI/m+wJ0Lh/iFmXJI+ASt1QoVHQ==";
const azure_storage_account_sharedKeyCredential = new StorageSharedKeyCredential(azure_storage_account, azure_storage_account_key);

const blobServiceClient = new BlobServiceClient(
  `https://${azure_storage_account}.blob.core.windows.net`,
  azure_storage_account_sharedKeyCredential
);
const containerClient = blobServiceClient.getContainerClient("products");


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './assets/uploads'); // Change the destination folder as needed
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});
// const storage = multer.memoryStorage();

const upload = multer({ storage });



router.get('/', (req, res) => {
    res.send('Welcome to the home page');
});
// mark order dispatched
router.get('/markOrderDispatched/:id', async (req, res)=>{
  try{
    const cart = await Cart.findOne({_id:req.params.id});
    if(cart){
      const cart = await Cart.updateOne(
        {_id:req.params.id},
        {
          $set: {
            status: "Dispatched"
          }
        }
        )

    }
    const user = await User.findOne({_id: cart.userId})

      await masterService.sendEmail(user.email, `Order Status (${req.params.id})`, "This Order has now been marked: <strong>Dispatched</strong>", "Three Amigos Corp")

      res.status(200).json({success:true, message: "Order updated successfully"})

  }catch(e){
    res.status(500).send({success:false, message: "Server error"})
  }
})
// mark order complete
router.get('/markOrderCompleted/:id', async (req, res)=>{
  try{
    const cart = await Cart.findOne({_id:req.params.id});
    if(cart){
      const cart = await Cart.updateOne(
        {_id:req.params.id},
        {
          $set: {
            status: "Completed"
          }
        }
        )

    }
    const user = await User.findOne({_id: cart.userId})

      await masterService.sendEmail(user.email, `Order Status (${req.params.id})`, "This Order has now been marked: <strong>Completed</strong>", "Three Amigos Corp")

      res.status(200).json({success:true, message: "Order updated successfully"})

  }catch(e){
    res.status(500).send({success:false, message: "Server error"})
  }
})
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
// Order view for management
router.get('/getCartItems', async (req, res) => {
  try {
    const statusArray = ['Processing', 'Dispatched', 'Completed'];

    // Find carts with the specified status
    const carts = await Cart.find({ status: { $in: statusArray } }).sort({ date: -1 });;

    if (!carts || carts.length === 0) {
      return res.status(404).json({ success: false, message: 'No carts found' });
    }

    // Fetch product details for each item in all carts and group by cartId
    const groupedCartItems = {};

    for (const cart of carts) {
      const cartStatus = cart.status;
      const createdAt = cart.date;

      for (const cartItem of cart.products) {
        const product = await Product.findById(cartItem.productId);

        if (product) {
          if (!groupedCartItems[cart._id]) {
            groupedCartItems[cart._id] = {
              status: cartStatus,              
              date: createdAt,
              products: [],
            };
          }

          groupedCartItems[cart._id].products.push({
            cartId: cart._id,
            productId: cartItem.productId,
            quantity: cartItem.quantity,
            price: Math.round(cartItem.price,2),
            productName: product.name,
            image: product.images[0],
            productDescription: product.description,
            // Add other product details you want to include
          });
        } else {
          // Handle the case when product is not found
        }
      }
    }

    res.status(200).json({ success: true, data: groupedCartItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// add a product
router.post('/addProduct', upload.single('productpic'), async (req, res) => {
  try {
    const imagePath = req.file.path;

    // Upload image to Azure Storage Blob
    const blobName = path.basename(imagePath);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Ensure that the blockBlobClient is successfully created
    if (!blockBlobClient) {
      return res.status(500).json({ success: false, message: 'Error creating BlockBlobClient' });
    }

    await blockBlobClient.uploadFile(imagePath);

    // Generate a SAS token for the image
    const sasToken = await blockBlobClient.generateSasUrl({
      permissions: 'r', // 'READ' permission
      startsOn: new Date(),
      expiresOn: new Date("9999-12-31T23:59:59Z"), // Expires in a very distant future
    });

    // Delete the local image file
    fs.unlinkSync(imagePath);
    const sp = req.body.price*1.1;

    const newProduct = new Product({
      name: req.body.productname,
      description: req.body.description,
      bp: req.body.price,
      price: sp,
      category: req.body.category,
      brand: req.body.brand,
      stockQuantity: req.body.quantity,
      images: [sasToken],
      supplier: req.body.supplier
    });

    const savedProduct = await newProduct.save();

    // Include the SAS token as a query parameter in the URL
    const productWithSas = {
      ...savedProduct._doc,
      images: [`${sasToken}`],
    };
    const user = await User.findOne({_id: req.body.supplier})
    await masterService.sendEmail(user.email, `New Producted Added`, `Hello ${user.firstname} ${user.lastname}, Your Product has successfully been added. Adios.`, "Three Amigos Corp")
    
    res.status(200).json({ success: true, message: "Product added successfully", data: productWithSas });
  } catch (error) {
    console.error(error);
    res.status(201).json({ success: false, message: "Server Error" });
  }
});
router.post('/addTransaction', async (req, res) => {
  try {
    const { amount, date, userId, description } = req.body;

    // Create a new transaction instance
    const newTransaction = new Transaction({
      amount,
      date,
      userId,
      description,
    });

    // Save the transaction to the database
    const savedTransaction = await newTransaction.save();

    res.status(201).json({ success: true, message: 'Transaction added successfully', data: savedTransaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// get user orders
router.get('/getUserOrders/:id', async(req, res)=>{
  try{
    const orders = await Cart.find({userId: req.params.id, status: "Processing" || "Dispatched" || "Completed"});
    if(!orders){
      return res.status(200).json({success:false, message: "No Orders Yet"})
    }

    res.status(200).json({success:true, data: orders})

  }catch(e){
    res.status(500).json({success:false, message: "Server error."})
  }
})


// get all the products
router.get('/getAllProducts', async (req, res) => {
  try {
    // Get all products
    const allProducts = await Product.find({approved: true});

    // Create an array to store unique product identifiers (e.g., name and brand)
    const uniqueIdentifiers = [];

    // Filter the products to include only the first instance for each unique product
    const uniqueProducts = allProducts.filter(product => {
      const identifier = `${product.name}-${product.brand}`;
      if (!uniqueIdentifiers.includes(identifier)) {
        uniqueIdentifiers.push(identifier);
        return true;
      }
      return false;
    });

    res.status(200).json({ success: true, data: uniqueProducts });
  } catch (e) {
    res.status(500).json({ success: false, message: e });
  }
});
// get cart items
router.get('/getUserCartItems/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const cart = await Cart.findOne({ userId: userId, status: "Pending" }).populate({
      path: 'products.productId',
      select: 'name images', // Include 'images' in the select to fetch from the Product model
    });

    if (!cart || !cart.products) {
      return res.status(200).json({ success: false, message: 'No Items in Cart' });
    }

    const cartItems = cart.products.map(item => ({
      productId: item.productId._id,
      quantity: item.quantity,
      price: item.price,
      name: item.productId.name,
      image: item.productId.images[0], // Adjust this line based on your actual structure
    }));

    const response = {
      totalAmount: cart.totalAmount,
      cartItems: cartItems,
      id: cart._id
    };

    res.status(200).json({ success: true, data: response });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});
// get all the transactions
router.get('/getUserTransactions/:id', async(req, res)=>{
    try{
      const id = req.params.id
      const transactions = await Transaction.find({userId: id});
      if(!transactions){
        res.status(200).send({success: false, messasge: "No Transactions Found"})
      }

      res.status(200).send({success:true, message: "Transactions found", data:transactions})
      
    }catch(e){
      console.log(e)
      res.status(200).send({success: false, messasge: "Some error occured"})
    }
})
// update user details
router.put('/updateUser', async (req, res) => {
  try {
    // const userId = req.body.id;
    const {id, firstname, lastname, address, phone } = req.body;

    // Find the user by ID
    const user = await User.findById(id);

    // If the user doesn't exist, return an error
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user details based on provided data (retain current data if new data is null or empty)
    user.firstname = firstname !== null && firstname !== '' ? firstname : user.firstname;
    user.lastname = lastname !== null && lastname !== '' ? lastname : user.lastname;
    user.address = address !== null && address !== '' ? address : user.address;
    user.phone = phone !== null && phone !== '' ? phone : user.phone;

    // Save the updated user details
    const updatedUser = await user.save();

    res.status(200).json({ success: true, message: 'User details updated', data: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// check out
router.get('/checkout/:cartId', async (req, res) => {
  try {
    const cartId = req.params.cartId;    

    // Step 1: Get the cart by cartid
    const cart = await Cart.findById(cartId);

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }  
    // get the user details
    const buyer = await User.findOne({_id:cart.userId})
    

    // Step 2: Update suppliers' balances with bp of the products
    for (const cartProduct of cart.products) {
      // Get the product details from the Product model
      const product = await Product.findById(cartProduct.productId);


      if (product) {
        // Get the supplier details from the User model
        const supplier = await User.findById(product.supplier);

        if (supplier) {
          // Increase the supplier's balance with the bp of the product
          supplier.balance += (product.price*0.91*cartProduct.quantity); // Adjust based on your actual bp property
          await supplier.save();
          // increment system balance
          
            await SystemBalance.updateOne(  
              {_id:"659afc0e4acb5e3bed729e3f"},        
              {
                $inc: {
                  totalAmount: (product.price*cartProduct.quantity*0.09),
                },
                $set: {
                  date: Date.now()
                }
                
              }
            );

          
          
        }
      }
      // update the quantity
      await Product.updateOne(
        {_id: cartProduct.productId},
        {
          $inc: {
            stockQuantity: -cartProduct.quantity
          }
        }
      )

    }

    // Step 3: Mark the cart status as processing
    cart.status = 'Processing';
    await cart.save();
    // register the transaction
    const newTransaction = new Transaction({
      amount: cart.totalAmount,
      userId: cart.userId,
      description: "Purchase of Goods"
    })

    await newTransaction.save();   
    // update user Balance
     await User.updateOne(
      {_id: cart.userId},
      {
        $inc:{
          balance: -cart.totalAmount

        }
      })
      await masterService.sendEmail(buyer.email, `Order Status`, `Order status for Order::${cartId} now marked as: Processing`, "Three Amigos Corp")

      await masterService.sendEmail(buyer.email, `${cart.userId} Checkout`, `Payment of £${cart.totalAmount} Successful. Thank you for shopping with us. Adios.`, "Three Amigos Corp Checkout")

    // Step 4: Give a response
    res.status(200).json({ success: true, message: 'Checkout successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
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

  // send email
  router.post('/sendEmail', async (req, res) => {
    const to = 'cosmopolink@gmail.com';
    const subject = 'ORDER XX865X';
    const text = 'Just saying hello';
    const title = "Order Status"
    const link = "https://3acs-webapp-2.azurewebsites.net/dashboard/market"
  
    try {
      const result = await masterService.sendEmail(to, subject, text,title, link);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).send(error);
    }
});

  // add to cart
  router.post('/addToCart', async (req, res) => {
    try {
      const { userId, productId, quantity } = req.body;
  
      // Find the user's cart
      let cart = await Cart.findOne({ userId:userId, status:"Pending" });
  
      // If the user doesn't have a cart, create a new one
      if (!cart) {
        cart = new Cart({
          userId, status:"Pending"
        });
      }
  
      // Find the product details
      const product = await Product.findById(productId);
  
      // If the product doesn't exist, return an error
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      // Check if the product is already in the cart
      const existingProduct = cart.products.find((item) => item.productId.toString() === productId);
  
      if (existingProduct) {
       // If the product is already in the cart, increment the quantity and update the total amount
        await Cart.updateOne(
          { userId:userId, 'products.productId': productId },
          {
            $inc: {
              'products.$.quantity': quantity,
              'products.$.price': quantity * product.price,
            },
            $set: {
              totalAmount: cart.totalAmount + quantity * product.price,
            },
          }
        );
      } else {
      const user = await User.findOne({_id: userId});

        await masterService.sendEmail(user.email, `New Order Created`, `Creation of new order Successful. Thank you for shopping with us. Adios.`, "Three Amigos Corp")
        // If the product is not in the cart, add it to the products array
        cart.products.push({
          productId,
          quantity,
          price: quantity * product.price,
        });
      }
  
      // Update the total amount in the cart
      cart.totalAmount = cart.products.reduce((total, item) => total + item.price, 0);
  
      // Save the cart to the database
      const savedCart = await cart.save();
      
  
      res.status(200).json({ success: true, message: 'Product added to cart', cart: savedCart });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });
  router.post('/rejectProduct', async (req, res) => {
    try {
      const id = req.body.id;
  
      // Find the product by ID
      const product = await Product.findById(id);
  
      // Check if the product exists
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      // Update the 'approved' field to true
      product.approved = false;
  
      // Save the updated product
      const updatedProduct = await product.save();
  
      res.status(200).json({ success: true, message: 'Operation completed successfully', data: updatedProduct });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });

  router.get('/deleteUserAccount/:id', async(req, res)=>{    
    try{
      const id = req.params.id
      const deleteAccount = await User.deleteOne({_id:id})

      res.status(200).json({success:true, message: "Operation Successful"})

    }catch(e){
      res.status(500).json({success:false, message: "Server error"})
    }
  })

  router.post('/addFunds', async (req, res) => {
    try {
      const { userid, amount } = req.body;
  
      // Check if the user exists
      const user = await User.findById(userid);
  
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Check if the user has a balance field
      if (user.balance) {
        // If the user has a balance, add the amount to it
        user.balance += parseFloat(amount);
      } else {
        // If the user doesn't have a balance, create a new field
        user.balance = parseFloat(amount);
      }
      // save the transaction
      const newTransaction = new Transaction({
        amount: amount,
        userId: userid,
        description: "Added Funds"
      })
      
      // Save the updated user
      const updatedUser = await user.save();
      const addTransaction = await newTransaction.save();
      await masterService.sendEmail(user.email, `Wallet topup`, `Top up of £${amount} Successful. Thank you for your continued trust in us. Adios.`, "Three Amigos Corp")
  
      res.status(200).json({ success: true, message: 'Funds added successfully', data: updatedUser, transaction: addTransaction });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });

  router.get('/getProductDetails/:id', async(req, res)=>{
    try{
      const product = await Product.findOne({_id: req.params.id});
      if(product){
        res.status(200).json({success:true, message: "Product exists", data: product})
      }else{
        res.status(200).json({success:false, message: "Product not found"})
      }

    }catch(e){
      res.status(500).json({success:false, message: e})

    }
    
  })
  // Route to delete an item from the cart
  router.delete('/deleteFromCart/:cartId/:productId', async (req, res) => {
    try {
      const { cartId, productId } = req.params;

      // Find the cart by ID
      const cart = await Cart.findById(cartId);

      // If the cart doesn't exist, return an error
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      // Remove the product from the products array
      cart.products = cart.products.filter((item) => item._id.toString() !== productId);

      // Update the total amount in the cart
      cart.totalAmount = cart.products.reduce((total, item) => total + item.price, 0);

      // Save the updated cart to the database
      const updatedCart = await cart.save();

      res.status(200).json({ success: true, message: 'Product removed from cart', cart: updatedCart });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });
  // Route to update product quantity by 1
  router.put('/incrementQuantity/:cartId/:productId', async (req, res) => {
    try {
      const { cartId, productId } = req.params;

      // Find the cart by ID
      const cart = await Cart.findById(cartId);

      // If the cart doesn't exist, return an error
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      // Find the product in the products array
      const product = cart.products.find((item) => item._id.toString() === productId);

      // If the product doesn't exist, return an error
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found in cart' });
      }

      // Update the quantity and price of the product by 1
      product.quantity += 1;
      product.price += product.price;

      // Update the total amount in the cart
      cart.totalAmount = cart.products.reduce((total, item) => total + item.price, 0);

      // Save the updated cart to the database
      const updatedCart = await cart.save();

      res.status(200).json({ success: true, message: 'Product quantity incremented', cart: updatedCart });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });

  // Route to decrease product quantity by 1
  router.put('/decrementQuantity/:cartId/:productId', async (req, res) => {
    try {
      const { cartId, productId } = req.params;

      // Find the cart by ID
      const cart = await Cart.findById(cartId);

      // If the cart doesn't exist, return an error
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      // Find the product in the products array
      const product = cart.products.find((item) => item._id.toString() === productId);

      // If the product doesn't exist, return an error
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found in cart' });
      }

      // Decrease the quantity and price of the product by 1
      if (product.quantity > 1) {
        product.quantity -= 1;
        product.price -= product.price;
      } else {
        // If the quantity is already 1, remove the product from the cart
        cart.products = cart.products.filter((item) => item._id.toString() !== productId);
      }

      // Update the total amount in the cart
      cart.totalAmount = cart.products.reduce((total, item) => total + item.price, 0);

      // Save the updated cart to the database
      const updatedCart = await cart.save();

      res.status(200).json({ success: true, message: 'Product quantity decremented', cart: updatedCart });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });


  



module.exports = router;
  