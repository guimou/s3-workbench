import config from '@app/config';
import axios from 'axios';
import * as React from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import Emitter from '../../utils/emitter';

interface SettingsProps { }

class S3Settings {
    access_key: string;
    secret_key: string;
    bucket_name: string;
    region: string;
    endpoint: string;

    constructor(access_key: string, secret_key: string, bucket_name: string, region: string, endpoint: string) {
        this.access_key = access_key;
        this.secret_key = secret_key;
        this.bucket_name = bucket_name;
        this.region = region;
        this.endpoint = endpoint;
    }
}

const Settings: React.FunctionComponent<SettingsProps> = () => {
    const history = useHistory();
    const location = useLocation();
    const params = useParams();

    const [s3Settings, setS3Settings] = React.useState<S3Settings | null>(null);

    React.useEffect(() => {
        axios.get(`${config.backend_api_url}/settings`)
            .then((response) => {
                const { settings } = response.data;
                if (settings !== undefined) {
                    setS3Settings(new S3Settings(settings.accessKeyId, settings.secretAccessKey, settings.bucket_name, settings.region, settings.endpoint));
                }
            })
            .catch((error) => {
                console.error(error);
                Emitter.emit('error', 'Failed to fetch configuration settings.');
            });
    }, []);

    return (
        <div>
            <h1>Settings</h1>
            <p>Access key: {s3Settings?.access_key}</p>
            <p>Secret key: {s3Settings?.secret_key}</p>
            <p>Bucket name: {s3Settings?.bucket_name}</p>
            <p>Region: {s3Settings?.region}</p>
            <p>Endpoint: {s3Settings?.endpoint}</p>
        </div>
    );
};

export default Settings;
