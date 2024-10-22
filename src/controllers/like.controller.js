import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Tweet } from "../models/tweet.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: toggle like on video
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const alreadyLikedInstance = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });

  if (alreadyLikedInstance) {
    await Like.findByIdAndDelete(alreadyLikedInstance._id);

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: false }, "Video unliked"));
  }

  await Like.create({
    video: videoId,
    likedBy: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: true }, "Video liked"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //TODO: toggle like on comment
  if (!isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment id");

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");

  const alreadyLikedInstance = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });

  if (alreadyLikedInstance) {
    await Like.findByIdAndDelete(alreadyLikedInstance._id);

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: false }, "Comment unliked"));
  }

  await Like.create({
    comment: commentId,
    likedBy: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: true }, "Comment liked"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //TODO: toggle like on tweet
  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id");

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(404, "Tweet not found");

  const alreadyLikedInstance = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  if (alreadyLikedInstance) {
    await Like.findByIdAndDelete(alreadyLikedInstance._id);

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: false }, "Tweet unliked"));
  }

  await Like.create({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: true }, "Tweet liked"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos
  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
            },
          },
          {
            $unwind: "$owner",
          },
          {
            $project: {
              videoFile: 1,
              thumbnail: 1,
              title: 1,
              description: 1,
              views: 1,
              duration: 1,
              isPublished: 1,
              owner: {
                _id: 1,
                fullName: 1,
                username: 1,
                avatar: 1,
              },
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$likedVideo",
    },
    {
      $replaceRoot: {
        newRoot: "$likedVideo",
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };
