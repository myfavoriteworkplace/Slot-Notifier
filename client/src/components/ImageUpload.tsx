import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, X, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";

interface ImageUploadProps {
  currentImage?: string;
  onImageUploaded: (url: string) => void;
  folder: "doctors" | "clinics" | "users";
  fallbackText?: string;
  allowedTypes?: string[];
  maxSizeKb?: number;
}

export function ImageUpload({ currentImage, onImageUploaded, folder, fallbackText = "?", allowedTypes, maxSizeKb }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = allowedTypes ?? ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      const typeLabels: Record<string, string> = {
        "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "image/svg+xml": "SVG",
      };
      const allowed = validTypes.map(t => typeLabels[t] ?? t).join(", ");
      toast({
        title: "Invalid file type",
        description: `Only ${allowed} files are accepted here.`,
        variant: "destructive",
      });
      return;
    }

    const maxBytes = (maxSizeKb ?? 2048) * 1024;
    let fileToUpload = file;
    if (file.size > maxBytes) {
      try {
        fileToUpload = await compressImage(file, maxBytes, 1500);
        if (fileToUpload.size > maxBytes) {
          const label = (maxSizeKb ?? 2048) >= 1024
            ? `${((maxSizeKb ?? 2048) / 1024).toFixed(0)} MB`
            : `${maxSizeKb ?? 2048} KB`;
          toast({
            title: "File too large",
            description: `Could not compress this image below ${label}. Please use a smaller image.`,
            variant: "destructive",
          });
          return;
        }
      } catch {
        const label = (maxSizeKb ?? 2048) >= 1024
          ? `${((maxSizeKb ?? 2048) / 1024).toFixed(0)} MB`
          : `${maxSizeKb ?? 2048} KB`;
        toast({
          title: "File too large",
          description: `Maximum allowed size is ${label}. Please resize or compress the image.`,
          variant: "destructive",
        });
        return;
      }
    }

    const localPreview = URL.createObjectURL(fileToUpload);
    setPreviewUrl(localPreview);

    setIsUploading(true);
    try {
      const signedUrlRes = await apiRequest("POST", "/api/uploads/signed-url", {
        fileName: fileToUpload.name,
        fileType: fileToUpload.type,
        fileSize: fileToUpload.size,
        folder,
      });

      if (!signedUrlRes.ok) {
        const error = await signedUrlRes.json();
        throw new Error(error.message || "Failed to get upload URL");
      }

      const { uploadUrl, publicUrl, key } = await signedUrlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: fileToUpload,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      // Use the key as the identifier in our database
      onImageUploaded(key);
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
      <div className="relative group cursor-pointer" onClick={() => !isUploading && fileInputRef.current?.click()}>
        <Avatar className="h-16 w-16 border rounded-2xl transition-all group-hover:opacity-80">
          {previewUrl ? (
            <AvatarImage src={previewUrl} alt="Preview" className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-white font-bold rounded-2xl text-sm tracking-widest">
            {(() => {
              const words = fallbackText.trim().split(/\s+/).filter(Boolean);
              if (words.length === 0) return <User className="h-8 w-8" />;
              if (words.length === 1) return words[0].charAt(0).toUpperCase();
              return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
            })()}
          </AvatarFallback>
        </Avatar>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
              {previewUrl ? "Change" : "Upload"}
            </span>
          )}
        </div>

        {previewUrl && !isUploading && (
          <button
            type="button"
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110 active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            data-testid="button-remove-image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={(allowedTypes ?? ["image/jpeg", "image/png", "image/webp"]).join(",")}
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-upload"
      />
    </div>
  );
}
