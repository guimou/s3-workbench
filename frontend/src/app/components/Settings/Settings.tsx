import config from '@app/config';
import axios from 'axios';
import * as React from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import Emitter from '../../utils/emitter';
import { Page, PageSection, Text, TextContent, TextVariants, Form, FormGroup, Button, TextInput, TextInputGroup, TextInputGroupMain, TextInputGroupUtilities, Flex, FlexItem } from '@patternfly/react-core';
import { EyeIcon } from '@patternfly/react-icons';

interface SettingsProps { }

class S3Settings {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;

    constructor(accessKeyId: string, secretAccessKey: string, region: string, endpoint: string) {
        this.accessKeyId = accessKeyId ?? '';
        this.secretAccessKey = secretAccessKey ?? '';
        this.region = region ?? '';
        this.endpoint = endpoint ?? '';
    }
}

const Settings: React.FunctionComponent<SettingsProps> = () => {
    const history = useHistory();
    const location = useLocation();
    const params = useParams();

    const [s3Settings, setS3Settings] = React.useState<S3Settings>(new S3Settings('', '', '', ''));
    const [settingsChanged, setSettingsChanged] = React.useState<boolean>(false);

    const [showSecretKey, setShowSecretKey] = React.useState<boolean>(false);

    const handleChange = (value, field) => {
        setS3Settings(prevState => ({
            ...prevState,
            [field]: value,
        }));
        setSettingsChanged(true);
    };

    const handleSaveSettings = (event) => {
        event.preventDefault();
        console.log('Saving settings', s3Settings);
        axios.post(`${config.backend_api_url}/settings`, s3Settings)
            .then((response) => {
                Emitter.emit('notification', { variant: 'success', title: '', description: 'Settings saved successfully!' });
                setSettingsChanged(false);
            })
            .catch((error) => {
                console.error(error);
                Emitter.emit('notification', { variant: 'warning', title: '', description: 'Saving failed with the error: ' + error });
            });
    };

    const handleTestConnection = (event) => {
        event.preventDefault();
        axios.get(`${config.backend_api_url}/settings/test`)
            .then((response) => {
                Emitter.emit('notification', { variant: 'success', title: '', description: 'Connection successful!' });
            })
            .catch((error) => {
                console.error(error);
                Emitter.emit('notification', { variant: 'warning', title: '', description: 'Connection failed with the error: ' + error.response.data.message.Code });
            });
    }

    React.useEffect(() => {
        axios.get(`${config.backend_api_url}/settings`)
            .then((response) => {
                const { settings } = response.data;
                if (settings !== undefined) {
                    setS3Settings(new S3Settings(settings.accessKeyId, settings.secretAccessKey, settings.region, settings.endpoint));
                }
            })
            .catch((error) => {
                console.error(error);
                Emitter.emit('error', 'Failed to fetch configuration settings.');
            });
    }, []);

    return (
        <Page className='buckets-list'>
            <PageSection>
                <TextContent>
                    <Text component={TextVariants.h1}>Settings</Text>
                </TextContent>
            </PageSection>
            <PageSection>

                <Form onSubmit={handleSaveSettings}>
                    <TextContent>
                        <Text component={TextVariants.h2}>S3 Settings</Text>
                    </TextContent>
                    <FormGroup label="Access key" fieldId="accessKeyId">
                        <TextInput
                            value={s3Settings.accessKeyId}
                            onChange={(_event, value) => handleChange(value, 'accessKeyId')}
                            id="accessKeyId"
                            name="accessKeyId"
                            className='form-s3-settings'
                        />
                    </FormGroup>
                    <FormGroup label="Secret key" fieldId="secretAccessKey">
                        <TextInputGroup className='form-s3-settings'>
                            <TextInputGroupMain
                                value={s3Settings.secretAccessKey}
                                onChange={(_event, value) => handleChange(value, 'secretAccessKey')}
                                id="secretAccessKey"
                                name="secretAccessKey"
                                type={showSecretKey ? 'text' : 'password'}
                            />
                            <TextInputGroupUtilities>
                                <Button
                                    variant="plain"
                                    aria-label={showSecretKey ? 'Hide secret key' : 'Show secret key'}
                                    onClick={() => setShowSecretKey(!showSecretKey)}
                                >
                                    <EyeIcon />
                                </Button>
                            </TextInputGroupUtilities>
                        </TextInputGroup>
                    </FormGroup>
                    <FormGroup label="Region" fieldId="region">
                        <TextInput
                            value={s3Settings.region}
                            onChange={(_event, value) => handleChange(value, 'region')}
                            id="region"
                            name="region"
                            className='form-s3-settings'
                        />
                    </FormGroup>
                    <FormGroup label="Endpoint" fieldId="endpoint">
                        <TextInput
                            value={s3Settings.endpoint}
                            onChange={(_event, value) => handleChange(value, 'endpoint')}
                            id="endpoint"
                            name="endpoint"
                            className='form-s3-settings-long'
                        />
                    </FormGroup>
                    <Flex>
                        <FlexItem>
                            <Button type="submit" className='form-s3-submit' isDisabled={!settingsChanged}>Save S3 Settings</Button>
                        </FlexItem>
                        <FlexItem>
                            <Button className='form-s3-submit' onClick={handleTestConnection}>Test Connection</Button>
                        </FlexItem>
                    </Flex>


                </Form>
            </PageSection>
        </Page>
    );
};

export default Settings;
