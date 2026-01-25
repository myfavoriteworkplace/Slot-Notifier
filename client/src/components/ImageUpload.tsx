import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, X, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  currentImage?: string;
  onImageUploaded: (url: string) => void;
  folder: "doctors" | "clinics" | "users";
  fallbackText?: string;
}

export function ImageUpload({ currentImage, onImageUploaded, folder, fallbackText = "?" }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ 
        title: "Invalid file type", 
        description: "Please upload a JPG, PNG, or WebP image",
        variant: "destructive" 
      });
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ 
        title: "File too large", 
        description: "Maximum file size is 2MB",
        variant: "destructive" 
      });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setIsUploading(true);
    try {
      const signedUrlRes = await apiRequest("POST", "/api/uploads/signed-url", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        folder,
      });

      if (!signedUrlRes.ok) {
        const error = await signedUrlRes.json();
        throw new Error(error.message || "Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await signedUrlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      setPreviewUrl(publicUrl);
      onImageUploaded(publicUrl);
      toast({ title: "Image uploaded successfully" });
    } catch (err: any) {
      toast({ 
        title: "Upload failed", 
        description: err.message,
        variant: "destructive" 
      });
      setPreviewUrl(currentImage || null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onImageUploaded("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-12 w-12 border">
        {previewUrl ? (
          <AvatarImage src={previewUrl} alt="Preview" />
        ) : null}
        <AvatarFallback className="bg-primary/5 text-primary">
          {fallbackText.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-upload-image"
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          {previewUrl ? "Change" : "Upload"}
        </Button>

        {previewUrl && !isUploading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-destructive"
            onClick={handleRemove}
            data-testid="button-remove-image"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-upload"
      />
    </div>
  );
}
