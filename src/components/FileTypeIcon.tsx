"use client";

import React from "react";
import {
  FaFilePdf,
  FaFileExcel,
  FaFileWord,
  FaFilePowerpoint,
  FaFileImage,
  FaFileArchive,
  FaFileAudio,
  FaFileVideo,
  FaFileCode,
  FaFile,
} from "react-icons/fa";

type FileTypeIconProps = {
  filename?: string;
  className?: string;
  size?: number;
};

const FileTypeIcon: React.FC<FileTypeIconProps> = ({ filename, className = "h-4 w-4", size = 16 }) => {
  const ext = (filename?.split(".").pop() || "").toLowerCase();

  let Icon = FaFile;
  let colorClass = "text-muted-foreground";

  switch (ext) {
    case "pdf":
      Icon = FaFilePdf;
      colorClass = "text-red-600";
      break;
    case "xls":
    case "xlsx":
      Icon = FaFileExcel;
      colorClass = "text-green-600";
      break;
    case "doc":
    case "docx":
      Icon = FaFileWord;
      colorClass = "text-blue-600";
      break;
    case "ppt":
    case "pptx":
      Icon = FaFilePowerpoint;
      colorClass = "text-orange-600";
      break;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "bmp":
    case "webp":
      Icon = FaFileImage;
      colorClass = "text-sky-600";
      break;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      Icon = FaFileArchive;
      colorClass = "text-amber-600";
      break;
    case "mp3":
    case "wav":
    case "flac":
      Icon = FaFileAudio;
      colorClass = "text-purple-600";
      break;
    case "mp4":
    case "mov":
    case "mkv":
    case "webm":
      Icon = FaFileVideo;
      colorClass = "text-indigo-600";
      break;
    case "js":
    case "ts":
    case "tsx":
    case "json":
    case "xml":
    case "css":
    case "html":
      Icon = FaFileCode;
      colorClass = "text-teal-600";
      break;
    default:
      Icon = FaFile;
      colorClass = "text-muted-foreground";
  }

  return <Icon className={`${colorClass} ${className}`} size={size} aria-label={ext ? `${ext}-Datei` : "Datei"} />;
};

export default FileTypeIcon;