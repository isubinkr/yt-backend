import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
          fuzzy: { maxEdits: 1 },
        },
      },
    });
  }

  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  if (userId) {
    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid user ID");

    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({
      $sort: {
        createdAt: -1,
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
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
        duration: 1,
        views: 1,
        owner: 1,
        createdAt: 1,
      },
    }
  );
  // optionally we can take isWatched as well

  const videoAggregate = Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const videos = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
  if (!title || !description)
    throw new ApiError(400, "Title and description are required");

  const videoLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoLocalPath || !thumbnailLocalPath)
    throw new ApiError(400, "Video file and thumbnail are required");

  const video = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!video || !thumbnail)
    throw new ApiError(400, "Error uploading video and thumbnail");

  const uploadedVideo = await Video.create({
    videoFile: video?.url,
    thumbnail: thumbnail?.url,
    title,
    description,
    duration: video.duration,
    owner: req.user?._id,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { video: uploadedVideo },
        "Video uploaded successfully"
      )
    );
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        owner: 1,
        createdAt: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);
  // can optionally add comments count as well

  if (!video?.length) throw new ApiError(404, "Video does not exist");

  //TODO: only send video if published: true

  if (video[0].owner?._id.toString() === req.user?._id.toString()) {
    // for ownere only add the video to watch history but don't count the views
    await User.findByIdAndUpdate(req.user?._id, {
      $addToSet: { watchHistory: videoId },
    });
    return res
      .status(200)
      .json(new ApiResponse(200, video[0], "Video fetched successfully"));
  }

  if (video[0].isPublished === false) {
    throw new ApiError(403, "Video is not published");
  }

  // increment view count only if the video was fetched successfully and is viewable
  // and also we are not counting the owner's view
  await Video.findByIdAndUpdate(videoId, {
    $inc: { views: 1 },
  });

  // add this video to user's watch history
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: { watchHistory: videoId },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  if (!title || !description)
    throw new ApiError(400, "Title and description are required");

  const uploadedVideo = await Video.findById(videoId);

  if (!uploadedVideo) throw new ApiError(404, "Video not found");

  if (req.user._id.toString() !== uploadedVideo.owner.toString())
    throw new ApiError(403, "You are not authorized to update this video");

  const newThumbnailLocalPath = req.file?.path;

  if (!newThumbnailLocalPath)
    throw new ApiError(400, "New Thumbnail is required");

  const newThumbnail = await uploadOnCloudinary(newThumbnailLocalPath);

  if (!newThumbnail) throw new ApiError(400, "Error uploading new thumbnail");

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: newThumbnail?.url,
      },
    },
    { new: true }
  );

  if (!updatedVideo) throw new ApiError(500, "Error updating video");

  // delete the old thumbnail
  const oldThumbnailUrl = uploadedVideo.thumbnail;

  const deletedThumbnailResponse = await deleteFromCloudinary(oldThumbnailUrl);

  // if (!deletedThumbnailResponse)
  //   throw new ApiError(500, "Error deleting old thumbnail");

  if (!deletedThumbnailResponse) {
    console.error("Failed to delete the old thumbnail from Cloudinary");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { updatedVideo }, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const uploadedVideo = await Video.findById(videoId);
  if (!uploadedVideo) throw new ApiError(404, "Video not found");

  if (req.user._id.toString() !== uploadedVideo.owner.toString())
    throw new ApiError(403, "You are not authorized to delete this video");

  const videoFileUrl = uploadedVideo.videoFile;
  const thumbnailUrl = uploadedVideo.thumbnail;

  const deletedVideo = await Video.findByIdAndDelete(videoId);
  if (!deletedVideo) throw new ApiError(500, "Error deleting video");

  // delete all likes and comments associated with the deleted video
  await Like.deleteMany({
    video: videoId,
  });
  await Comment.deleteMany({
    video: videoId,
  });

  let deletionErrors = [];

  const videoFileResponse = await deleteFromCloudinary(videoFileUrl, "video");
  if (!videoFileResponse) {
    deletionErrors.push("Failed to delete video file");
  }

  const thumbnailResponse = await deleteFromCloudinary(thumbnailUrl);
  if (!thumbnailResponse) {
    deletionErrors.push("Failed to delete thumbnail");
  }

  if (deletionErrors.length > 0) {
    // throw new ApiError(500, "Error deleting files from Cloudinary");
    console.error("Deletion errors: ", deletionErrors);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { deletedVideo },
          "Video deleted, but some assets failed to delete"
        )
      );
  }

  // optionally we can also delete the video from viewer's(user) watch history as well

  // TODO: Delete all comments and likes associated with the deleted video

  return res
    .status(200)
    .json(new ApiResponse(200, { deletedVideo }, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID");

  const uploadedVideo = await Video.findById(videoId);
  if (!uploadedVideo) throw new ApiError(404, "Video not found");

  if (req.user._id.toString() !== uploadedVideo.owner.toString())
    throw new ApiError(
      403,
      "You are not authorized to toggle the publish status of this video"
    );

  const newPublishStatus = !uploadedVideo.isPublished;

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: newPublishStatus,
      },
    },
    { new: true }
  );

  if (!updatedVideo) throw new ApiError(500, "Error updating video");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { updatedVideo },
        "Video publish status toggled successfully"
      )
    );
});

export {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  togglePublishStatus,
  updateVideo,
};
