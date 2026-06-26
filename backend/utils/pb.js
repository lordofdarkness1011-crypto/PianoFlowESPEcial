const PocketBase = require('pocketbase/cjs');
const logger = require('./logger');

const pb = new PocketBase('http://localhost:8090');

const ADMIN_EMAIL = 'admin@pianoflow.com';
const ADMIN_PASSWORD = '1234567890';

const initPocketBase = async () => {
    try {
        // En PocketBase v0.23+, los admins están en '_superusers'
        try {
            await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
            logger.info('PocketBase: Autenticado como superusuario exitosamente.');
        } catch (error) {
            logger.error(`PocketBase: No se pudo autenticar. El superusuario debe crearse vía Docker. Error: ${error.message}`);
            return;
        }

        try {
            await pb.collections.getOne('avatars');
            logger.info('PocketBase: Colección "avatars" lista.');
        } catch (err) {
            logger.info('PocketBase: Colección "avatars" no existe. Creando...');
            await pb.collections.create({
                name: 'avatars',
                type: 'base',
                schema: [
                    {
                        name: 'file',
                        type: 'file',
                        required: true,
                        options: {
                            maxSelect: 1,
                            maxSize: 5242880,
                            mimeTypes: ['image/jpeg', 'image/png', 'image/webp']
                        }
                    }
                ],
                listRule: "",     
                viewRule: "",     
                createRule: null, 
                updateRule: null, 
                deleteRule: null  
            });
            logger.info('PocketBase: Colección "avatars" creada exitosamente.');
        }
    } catch (error) {
        logger.error(`Error configurando colección PocketBase: ${error.message}`);
    }
};

module.exports = { pb, initPocketBase };
