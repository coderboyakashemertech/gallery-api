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
