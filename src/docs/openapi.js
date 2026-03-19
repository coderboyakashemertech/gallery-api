const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Gallery API",
    version: "1.0.0",
    description:
      "Express authentication API with Prisma, SQLite, JWT auth, and TOTP-based 2FA."
  },
  servers: [
    {
      url: "/",
      description: "Current server"
    }
  ],
  tags: [
    { name: "System", description: "Health and status endpoints" },
    { name: "Drives", description: "Drive discovery endpoints" },
    { name: "Auth", description: "Registration, login, and profile endpoints" },
    { name: "Two-Factor", description: "TOTP setup and verification endpoints" },
    { name: "Favorites", description: "User favorite image endpoints" },
    { name: "Protected API", description: "Endpoints gated by AUTH_ENABLED" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Authentication required" },
          message: {
            type: "string",
            example: "Provide a valid JWT bearer token."
          }
        }
      },
      User: {
        type: "object",
        properties: {
          username: { type: "string", example: "jdoe" },
          name: { type: "string", example: "John Doe" },
          twoFactorEnabled: { type: "boolean", example: false }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["username", "name", "password"],
        properties: {
          username: { type: "string", example: "jdoe" },
          name: { type: "string", example: "John Doe" },
          password: { type: "string", example: "supersecret123" }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "jdoe" },
          password: { type: "string", example: "supersecret123" },
          otp: { type: "string", example: "123456" }
        }
      },
      OtpRequest: {
        type: "object",
        required: ["otp"],
        properties: {
          otp: { type: "string", example: "123456" }
        }
      },
      DrivePathRequest: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            example: "/mnt/c/Users/akash/Downloads/New Folder"
          }
        }
      },
      FavoriteImageRequest: {
        type: "object",
        required: ["imageUrl"],
        properties: {
          imageUrl: {
            type: "string",
            example: "https://cdn.example.com/images/sunset.jpg"
          }
        }
      },
      FavoriteImage: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          imageUrl: {
            type: "string",
            example: "https://cdn.example.com/images/sunset.jpg"
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-03-19T10:15:30.000Z"
          }
        }
      },
      RegisterResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "User registered successfully." },
          token: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          },
          user: { $ref: "#/components/schemas/User" }
        }
      },
      LoginResponse: {
        type: "object",
        properties: {
          requiresTwoFactor: { type: "boolean", example: false },
          token: {
            type: "string",
            nullable: true,
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          },
          user: { $ref: "#/components/schemas/User" }
        }
      },
      TwoFactorSetupResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Scan the QR code and verify with your authenticator app."
          },
          secret: { type: "string", example: "BASE32SECRET" },
          otpauthUrl: { type: "string", example: "otpauth://totp/Gallery..." },
          qrCodeDataUrl: {
            type: "string",
            example: "data:image/png;base64,..."
          }
        }
      }
    }
  },
  paths: {
    "/": {
      get: {
        tags: ["System"],
        summary: "API status",
        responses: {
          200: {
            description: "API status response"
          }
        }
      }
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: {
            description: "Health status"
          }
        }
      }
    },
    "/api/drives": {
      get: {
        tags: ["Drives"],
        summary: "Return drives from drives.json",
        description:
          "Reads drives.json from the API project root first, then falls back to src/drives.json.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Drive list loaded from drives.json"
          },
          404: {
            description: "drives.json not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          500: {
            description: "Invalid JSON or read failure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/drives/folders": {
      get: {
        tags: ["Drives"],
        summary: "Recursively scan folders for a given path",
        description:
          "Returns a nested directory tree for the provided path query parameter. Only directories are included.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "path",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "/home/coderboy/projects/Gallery/api/src"
            },
            description: "Absolute or relative directory path to scan recursively."
          }
        ],
        responses: {
          200: {
            description: "Directory tree loaded successfully"
          },
          400: {
            description: "Missing path or path is not a directory",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Path does not exist",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/drives/files": {
      get: {
        tags: ["Drives"],
        summary: "Recursively list files for a given path",
        description:
          "Returns all files found under the provided path query parameter, including nested folders. File paths are URL-encoded.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "path",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "/home/coderboy/projects/Gallery/api/src"
            },
            description: "Absolute or relative directory path to scan recursively for files."
          }
        ],
        responses: {
          200: {
            description: "Files loaded successfully"
          },
          400: {
            description: "Missing path or path is not a directory",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Path does not exist",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/drives/folder": {
      post: {
        tags: ["Drives"],
        summary: "Create a folder",
        description:
          "Creates a folder at the provided absolute or relative path. Parent directory must already exist.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DrivePathRequest" }
            }
          }
        },
        responses: {
          201: {
            description: "Folder created successfully"
          },
          400: {
            description: "Missing or invalid folder path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Parent directory not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          409: {
            description: "Folder or file already exists at the target path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/drives/item": {
      delete: {
        tags: ["Drives"],
        summary: "Delete a file or folder",
        description:
          "Deletes the provided file or directory permanently. The encoded or plain path may be supplied in the request body or query string.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "path",
            in: "query",
            required: false,
            schema: {
              type: "string",
              example: "%2Fmnt%2Fc%2FUsers%2Fakash%2FDownloads%2Fold.txt"
            },
            description: "Optional encoded path to delete when not provided in the request body."
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DrivePathRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Item deleted successfully"
          },
          400: {
            description: "Missing or invalid path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Path not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/drives/recycle": {
      post: {
        tags: ["Drives"],
        summary: "Move a file or folder to the recycle bin",
        description:
          "Moves the provided file or directory to the recycle bin path configured by RECYCLE_BIN_PATH. If the name already exists there, a timestamp suffix is added.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DrivePathRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Item moved to recycle bin successfully"
          },
          400: {
            description: "Missing or invalid path, or item is already in the recycle bin",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Path not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          500: {
            description: "Recycle bin path is not configured",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/gallery/folders": {
      get: {
        tags: ["Drives"],
        summary: "Return folder metadata from gallery.json",
        description:
          "Reads gallery.json from the API project root first, then falls back to src/gallery.json. File lists are removed and only folder metadata is returned.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Gallery folders loaded successfully"
          },
          404: {
            description: "gallery.json not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          500: {
            description: "Invalid JSON or read failure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/gallery/files": {
      get: {
        tags: ["Drives"],
        summary: "Return file list for a gallery folder",
        description:
          "Reads gallery.json from the API project root first, then falls back to src/gallery.json. Returns the files for the folder matching the provided gallery path, with a public serve_url for each file.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "path",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "%2Fmnt%2Fc%2FUsers%2Fakash%2FDownloads"
            },
            description: "Encoded gallery folder path from /api/gallery/folders."
          }
        ],
        responses: {
          200: {
            description: "Gallery files loaded successfully"
          },
          400: {
            description: "Missing gallery path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "gallery.json or the requested gallery path was not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          500: {
            description: "Invalid JSON or read failure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/gallery/link": {
      get: {
        tags: ["Drives"],
        summary: "Generate an accessible gallery file URL",
        description:
          "Accepts a baseUrl and an encoded gallery file path, then returns the public gallery file endpoint URL.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "baseUrl",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "localhost:5000"
            },
            description: "Base URL to prepend. If no protocol is provided, http:// is used."
          },
          {
            name: "path",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "%2Fmnt%2Fc%2FUsers%2Fakash%2FDownloads%2FCompressed%2FHaldi%20Images%2FIMG_0958.JPG"
            },
            description: "Encoded gallery file path."
          }
        ],
        responses: {
          200: {
            description: "Gallery file link generated successfully"
          },
          400: {
            description: "Missing baseUrl, missing path, or invalid encoded path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/gallery/file": {
      get: {
        tags: ["Drives"],
        summary: "Serve a gallery file",
        description:
          "Streams the requested gallery file if the encoded path exists in gallery.json and the file exists on disk.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "path",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "%2Fmnt%2Fc%2FUsers%2Fakash%2FDownloads%2FCompressed%2FHaldi%20Images%2FIMG_0958.JPG"
            },
            description: "Encoded gallery file path from /api/gallery/files."
          }
        ],
        responses: {
          200: {
            description: "Gallery file stream"
          },
          400: {
            description: "Missing path or invalid encoded path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Gallery file path not found in gallery.json or file missing on disk",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/gallery/file": {
      get: {
        tags: ["Drives"],
        summary: "Serve a gallery file publicly",
        description:
          "Streams the requested gallery file if the encoded path exists in gallery.json and the file exists on disk. This route does not require authentication.",
        parameters: [
          {
            name: "path",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "%2Fmnt%2Fc%2FUsers%2Fakash%2FDownloads%2FCompressed%2FHaldi%20Images%2FIMG_0958.JPG"
            },
            description: "Encoded gallery file path from /api/gallery/files."
          }
        ],
        responses: {
          200: {
            description: "Gallery file stream"
          },
          400: {
            description: "Missing path or invalid encoded path",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: {
            description: "Gallery file path not found in gallery.json or file missing on disk",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" }
            }
          }
        },
        responses: {
          201: {
            description: "User registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterResponse" }
              }
            }
          },
          409: {
            description: "Username already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with username/password and optional OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Login result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" }
              }
            }
          },
          401: {
            description: "Invalid credentials or OTP",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/register": {
      post: {
        tags: ["Auth"],
        summary: "Register alias under /api",
        description: "Compatibility alias for /auth/register",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" }
            }
          }
        },
        responses: {
          201: {
            description: "User registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterResponse" }
              }
            }
          }
        }
      }
    },
    "/api/login": {
      post: {
        tags: ["Auth"],
        summary: "Login alias under /api",
        description: "Compatibility alias for /auth/login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "Login result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" }
              }
            }
          }
        }
      }
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user profile"
          },
          401: {
            description: "Missing or invalid JWT",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/auth/2fa/setup": {
      post: {
        tags: ["Two-Factor"],
        summary: "Start TOTP setup",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "2FA setup data",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TwoFactorSetupResponse" }
              }
            }
          }
        }
      }
    },
    "/auth/2fa/verify": {
      post: {
        tags: ["Two-Factor"],
        summary: "Verify and enable 2FA",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OtpRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "2FA enabled"
          }
        }
      }
    },
    "/auth/2fa/disable": {
      post: {
        tags: ["Two-Factor"],
        summary: "Disable 2FA",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OtpRequest" }
            }
          }
        },
        responses: {
          200: {
            description: "2FA disabled"
          }
        }
      }
    },
    "/api/protected": {
      get: {
        tags: ["Protected API"],
        summary: "Protected route behind AUTH_ENABLED",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Protected route response"
          },
          401: {
            description: "Missing or invalid JWT when AUTH_ENABLED=true",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/me": {
      get: {
        tags: ["Protected API"],
        summary: "Decoded auth payload for protected API access",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Protected user/auth payload"
          }
        }
      }
    },
    "/api/favorites/images": {
      get: {
        tags: ["Favorites"],
        summary: "List the authenticated user's favorite image links",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Favorite image links loaded successfully",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/FavoriteImage" }
                }
              }
            }
          },
          401: {
            description: "Missing or invalid JWT",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      },
      post: {
        tags: ["Favorites"],
        summary: "Save an image link to the authenticated user's favorites",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FavoriteImageRequest" }
            }
          }
        },
        responses: {
          201: {
            description: "Favorite image link saved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FavoriteImage" }
              }
            }
          },
          400: {
            description: "Missing imageUrl",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          401: {
            description: "Missing or invalid JWT",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    }
  }
};

const swaggerUiOptions = {
  customSiteTitle: "Gallery API Docs",
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: "list",
    defaultModelsExpandDepth: 2
  }
};

module.exports = {
  openApiSpec,
  swaggerUiOptions
};
