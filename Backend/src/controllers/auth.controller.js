const user_model = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
// ...existing code...

async function register(req,res){

    const{fullName:{firstname,lastname},email,Password} = req.body;

const user_hai_kya = await user_model.findOne({email:email});

if(user_hai_kya){
    return res.status(400).json({
        message:"User already exists"
    })
}

//password hashing
const hashed_password = await bcrypt.hash(Password,10);



// new user banega
const user = await user_model.create({
    fullName:{
        firstname:firstname,
        lastname:lastname
    },
    email:email,
    Password:hashed_password
})

//token generate
const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

res.cookie("token",token);

res.status(201).json({
    message:"User created successfully",
    user:{
        email:user.email,
        fullName:user.fullName,
        _id:user._id
    }
})

}

async function login(req,res){
    const{email,Password} = req.body;

    const user =  await user_model.findOne({
        email:email
    })

    if(!user){
        return res.status(400).json({
            message:"Please register first"
        })
    }
    const isPasswordMatch = await bcrypt.compare(Password,user.Password);

    if(!isPasswordMatch){
        return res.status(400).json({
            message:"Invalid credentials"
        })
    }
   const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" }); 

    res.cookie("token",token);
    res.status(200).json({
        message:"Login successful",
        user:{
            email:user.email,
            fullName:user.fullName,
            _id:user._id
        }
    })
}

module.exports = {register,login};