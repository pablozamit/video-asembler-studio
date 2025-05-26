FROM node:18-slim

# Instalar FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de archivos
COPY . .

# Construir la aplicación
RUN npm run build

# Crear directorio para uploads
RUN mkdir -p uploads && chmod 777 uploads

# Exponer el puerto
EXPOSE 8080

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8080

# Comando para iniciar la aplicación
CMD ["npm", "start"] 