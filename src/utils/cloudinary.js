import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully

    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    // remove the locally saved temporary file as the upload operation got failed
    fs.unlinkSync(localFilePath);
    return null;
  }
};

const extractPublicId = (url) => {
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  const publicId = filename.split(".")[0];
  return publicId;
};

const deleteFromCloudinary = async (url, resourceType = "image") => {
  try {
    if (!url) return null;

    const publicId = extractPublicId(url);

    const resource = await cloudinary.api.resource(publicId, {
      resource_type: `${resourceType}`,
    });

    if (!resource) {
      console.error("Resource not found on Cloudinary");
      return null;
    }

    // delete the file from cloudinary
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: `${resourceType}`,
    });

    if (response.result === "ok") {
      // deleted successfully
      return response;
    } else {
      // failed to delete file
      return null;
    }
  } catch (error) {
    // console.error("Error deleting file from Cloudinary:", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
