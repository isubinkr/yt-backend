import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

  const video = Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const commentAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        owner: {
          username: 1,
          fullName: 1,
          avatar: 1,
        },
        createdAt: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);
  // no need to add comments count
  // because it will be provided by mongoose-aggregate-paginate
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const comments = await Comment.aggregatePaginate(commentAggregate, options);

  res
    .status(200)
    .json(new ApiResponse(200, comments, "All comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");
  if (!content) throw new ApiError(400, "Content is required");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user._id,
  });

  if (!comment) throw new ApiError(500, "Failed to add comment");

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment id");
  if (!content) throw new ApiError(400, "Content is required");

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");

  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!updatedComment) throw new ApiError(500, "Failed to update comment");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.params;

  if (!isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment id");

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");

  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  const deletedComment = await Comment.findByIdAndDelete(commentId);

  if (!deletedComment) throw new ApiError(500, "Failed to delete comment");

  await Like.deleteMany({
    comment: commentId,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { deletedComment }, "Comment deleted successfully")
    );
});

export { getVideoComments, addComment, updateComment, deleteComment };
