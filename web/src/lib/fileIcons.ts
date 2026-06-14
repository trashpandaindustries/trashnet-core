import { FileText, FileCode, FileImage, FileVideo, FileAudio, FileArchive, File as FileIcon, LucideIcon } from 'lucide-react';

export function getFileIcon(filename: string): LucideIcon {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['txt', 'md', 'log', 'csv', 'rtf'].includes(ext)) {
    return FileText;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'sh', 'yaml', 'yml', 'json', 'toml', 'xml', 'html', 'css', 'scss'].includes(ext)) {
    return FileCode;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
    return FileImage;
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return FileVideo;
  }
  if (['mp3', 'flac', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return FileAudio;
  }
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext)) {
    return FileArchive;
  }
  return FileIcon;
}
