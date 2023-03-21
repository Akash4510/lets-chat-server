const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please tell us your first name!'],
  },

  lastName: {
    type: String,
    required: [true, 'Please tell us your last name!'],
  },

  avatar: {
    type: String,
  },

  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function (val) {
        return String(val)
          .toLowerCase()
          .match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/);
      },
      message: (props) => `${props.value} is not a valid email address!`,
    },
  },

  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },

  passwordChangedAt: {
    type: Date,
  },

  passwordResetToken: {
    type: String,
  },

  passwordResetExpires: {
    type: Date,
  },

  createdAt: {
    type: Date,
    default: Date.now(),
  },

  updatedAt: {
    type: Date,
  },

  verified: {
    type: Boolean,
    default: false,
  },

  otp: {
    type: String,
  },

  otpExpiryTime: {
    type: Date,
  },
});

userSchema.pre('save', async function (next) {
  // Hash the otp only if it is modified
  if (!this.isModified('otp')) return next();

  this.otp = await bcrypt.hash(this.otp, 12);

  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.correctOtp = async function (candidateOtp, userOtp) {
  return await bcrypt.compare(candidateOtp, userOtp);
};

const User = new mongoose.model('User', userSchema);
module.exports = User;
