import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet
  const user = req.user;
  const { tweet } = req.body;

  if (!tweet || !tweet.trim()) throw new ApiError(400, "Tweet is required");

  const createdTweet = await Tweet.create({
    owner: user._id,
    content: tweet,
  });

  if (!createdTweet)
    throw new ApiError(500, "Something went wrong while creating tweet");

  return res
    .status(200)
    .json(new ApiResponse(200, { createdTweet }, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const { userId } = req.params;

  if (!isValidObjectId(userId))
    throw new ApiError(400, "Invalid user ID format");

  const tweets = await Tweet.find({ owner: userId }).populate(
    "owner",
    "username fullName avatar"
  );

  if (!tweets?.length)
    throw new ApiError(
      404,
      "No tweets found for the user with the provided ID"
    );

  return res
    .status(200)
    .json(new ApiResponse(200, { tweets }, "Tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { tweetId } = req.params;
  const { tweet } = req.body;

  if (!isValidObjectId(tweetId))
    throw new ApiError(400, "Invalid tweet ID format");

  if (!tweet || !tweet.trim()) throw new ApiError(400, "Tweet is required");

  const savedTweet = await Tweet.findById(tweetId);

  if (!savedTweet) throw new ApiError(404, "Tweet not found");

  if (savedTweet.owner.toString() !== req.user._id.toString())
    throw new ApiError(403, "You are not authorized to update this tweet");

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: tweet,
      },
    },
    { new: true }
  );

  if (!updatedTweet)
    throw new ApiError(500, "Something went wrong while updating tweet");

  return res
    .status(200)
    .json(new ApiResponse(200, { updatedTweet }, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId))
    throw new ApiError(400, "Invalid tweet ID format");

  const savedTweet = await Tweet.findById(tweetId);

  if (!savedTweet) throw new ApiError(404, "Tweet not found");

  if (savedTweet.owner.toString() !== req.user._id.toString())
    throw new ApiError(403, "You are not authorized to delete this tweet");

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

  if (!deletedTweet)
    throw new ApiError(404, "Tweet not found or already deleted");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
