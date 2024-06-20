import config from '@app/config';
import { faDownload, faEye, faFile, faFolder, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Breadcrumb, BreadcrumbItem, Button, Card, FileUpload, Flex, FlexItem, Form, FormGroup, FormSelect, FormSelectOption, Modal, Page, PageSection, Progress, ProgressSize, Text, TextContent, TextInput, TextVariants, ToolbarContent, ToolbarGroup, ToolbarItem, Tooltip } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import axios from 'axios';
import * as React from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import Emitter from '../../utils/emitter';
import DocumentRenderer from '../DocumentRenderer/DocumentRenderer';

interface ObjectBrowserProps { }

class Bucket {
    Name: string;
    CreationDate: string;

    constructor(name: string, creationDate: string) {
        this.Name = name;
        this.CreationDate = creationDate;
    }
}

class Owner {
    DisplayName: string;
    ID: string;

    constructor(displayName: string, id: string) {
        this.DisplayName = displayName;
        this.ID = id;
    }
}

class BucketsList {
    buckets: Bucket[];
    owner: Owner;

    constructor(buckets: Bucket[], owner: Owner) {
        this.buckets = buckets;
        this.owner = owner;
    }
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${value} ${sizes[i]}`;
};

class S3Object {
    Key: string;
    LastModified: string;
    Size: string;
    OriginalSize: number;

    constructor(key: string, lastModified: string, originalSize: string) {
        this.Key = key;
        this.LastModified = lastModified;
        this.Size = formatBytes(parseInt(originalSize));
        this.OriginalSize = parseInt(originalSize);
    }
}

class S3Objects {
    s3Objects: S3Object[];

    constructor(Objects: S3Object[]) {
        this.s3Objects = Objects;
    }
}

class S3Prefix {
    Prefix: string;

    constructor(prefix: string) {
        this.Prefix = prefix;
    }
}

class S3Prefixes {
    s3Prefixes: S3Prefix[];

    constructor(Prefixes: S3Prefix[]) {
        this.s3Prefixes = Prefixes;
    }
}

interface ObjectRow {
    key: string;
    lastModified: string;
    size: string;
    originalSize: number;
}

interface PrefixRow {
    prefix: string;
}

const ObjectBrowser: React.FC<ObjectBrowserProps> = () => {
    const history = useHistory();
    const location = useLocation();
    const abortUploadController = React.useRef<AbortController | null>(null);
    const { bucketName } = useParams<{ bucketName: string }>();
    const { prefix } = useParams<{ prefix: string }>();

    const [formSelectBucket, setFormSelectBucket] = React.useState(bucketName);

    // Buckets handling
    const [bucketsList, setBucketsList] = React.useState<BucketsList | null>(null);

    // S3 Objects handling
    const [searchObjectText, setSearchObjectText] = React.useState('');
    const [decodedPrefix, setDecodedPrefix] = React.useState('');
    const [s3Objects, setS3Objects] = React.useState<S3Objects | null>(null);
    const [s3Prefixes, setS3Prefixes] = React.useState<S3Prefixes | null>(null);

    // File viewer handling
    const [fileData, setFileData] = React.useState('');
    const [fileName, setFileName] = React.useState('');
    const [isFileViewerOpen, setIsFileViewerOpen] = React.useState(false);

    const handleFileViewerToggle = (_event: KeyboardEvent | React.MouseEvent) => {
        setIsFileViewerOpen(!isFileViewerOpen);
    }

    const columnNames = {
        key: 'Key',
        lastModified: 'Last Modified',
        size: 'Size'
    };

    const prefixRows: PrefixRow[] = s3Prefixes ? s3Prefixes.s3Prefixes.map((s3Prefix) => ({
        prefix: s3Prefix.Prefix
    })) : [];

    const objectRows: ObjectRow[] = s3Objects ? s3Objects.s3Objects.map((s3Object) => ({
        key: s3Object.Key,
        lastModified: s3Object.LastModified,
        size: s3Object.Size,
        originalSize: s3Object.OriginalSize
    })) : [];

    // Filter the rows on all fields based on the search text
    const filteredRows = objectRows.filter(row =>
        Object.entries(row).some(([field, value]) => {
            if (field === 'key') {
                const lastSegment = value.split('/').pop();
                return lastSegment.toLowerCase().includes(searchObjectText.toLowerCase());
            } else {
                return value.toString().toLowerCase().includes(searchObjectText.toLowerCase());
            }
        })
    );

    const filteredPrefixRows = prefixRows.filter(row => {
        if (row.prefix) {
            const lastSegment = row.prefix.slice(0, -1).split('/').pop();
            return lastSegment && lastSegment.toLowerCase().includes(searchObjectText.toLowerCase());
        }
        return false;
    });


    const validateFileView = (filename: string, size: number) => {
        const allowedExtensions = ['txt', 'log', 'jpg', 'py', 'json', 'yaml', 'yml', 'md', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'sh', 'bash', 'sql', 'csv', 'xml', 'png', 'gif', 'bmp', 'jpeg', 'svg', 'webp', 'ico'];
        if (size > 1024 * 1024) {
            return false;
        }
        if (!allowedExtensions.includes(filename.split('.').pop() || '')) {
            return false;
        }
        return true;
    }

    const handlePrefixClick = (plainTextPrefix: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
        setS3Objects(null);
        setS3Prefixes(null);
        setDecodedPrefix(plainTextPrefix);
        history.push(plainTextPrefix !== '' ? `/objects/${bucketName}/${btoa(plainTextPrefix)}` : `/objects/${bucketName}`);
    }

    const handleObjectView = (key: string) => async (event: React.MouseEvent<HTMLButtonElement>) => {
        await axios.get(`${config.backend_api_url}/objects/view/${bucketName}/${btoa(key)}`, { responseType: 'arraybuffer' })
            .then((response) => {
                setFileName(key.split('/').pop() || '');
                const binary = new Uint8Array(response.data);
                const data = btoa(
                    binary.reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                setFileData(data);
                setIsFileViewerOpen(true);
            })
            .catch((error) => {
                console.error('Error viewing object', error);
            });
    }

    const handleBucketChange = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
        setFormSelectBucket(value);
        history.push(`/objects/${value}`);
    }

    // Fetch the objects from the object store bucket
    React.useEffect(() => {
        let url = '';
        if (bucketName === ':bucketName') {
            return;
        }
        if (prefix === undefined || prefix === ':prefix') {
            setDecodedPrefix('');
            url = `${config.backend_api_url}/objects/${bucketName}`;
        } else {
            setDecodedPrefix(atob(prefix));
            url = `${config.backend_api_url}/objects/${bucketName}/${prefix}`;
        }
        axios.get(url)
            .then((response) => {
                const { objects, prefixes } = response.data;
                if (objects !== undefined) {
                    const newS3Objects = new S3Objects(
                        objects.map((s3Object: any) => new S3Object(s3Object.Key, s3Object.LastModified, s3Object.Size))
                    );
                    setS3Objects(newS3Objects);
                } else {
                    setS3Objects(null);
                }
                if (prefixes !== undefined) {
                    const newS3Prefixes = new S3Prefixes(
                        prefixes.map((s3Prefix: any) => new S3Prefix(s3Prefix.Prefix))
                    );
                    setS3Prefixes(newS3Prefixes);
                } else {
                    setS3Prefixes(null);
                }
            })
            .catch((error) => {
                console.error('Error fetching objects', error);
            });
    }, [location, prefix]);

    // Load buckets at startup
    React.useEffect(() => {
        axios.get(`${config.backend_api_url}/buckets`)
            .then(response => {
                const { owner, buckets } = response.data;
                const newBucketsState = new BucketsList(
                    buckets.map((bucket: any) => new Bucket(bucket.Name, bucket.CreationDate)),
                    new Owner(owner.DisplayName, owner.ID)
                );
                setBucketsList(newBucketsState);
                if (bucketName === ":bucketName") {
                    history.push(`/objects/${buckets[0].Name}`);
                }
            })
            .catch(error => {
                console.error(error);
            });
    }, [location]);

    // Upload file handling
    const [isUploadFileModalOpen, setIsUploadFileModalOpen] = React.useState(false);
    const handleUploadFileModalToggle = (_event: KeyboardEvent | React.MouseEvent) => {
        setIsUploadFileModalOpen(!isUploadFileModalOpen);
    }

    const resetUploadPanel = () => {
        setFileUploadValue(undefined);
        setFilename('');
        setUploadedToS3Percentage(-1);
        setUploadedPercentage(-1);
        setIsUploadFileModalOpen(false);
        abortUploadController.current = null;
    }

    const handleUploadFileCancel = (_event: React.MouseEvent) => {
        if (abortUploadController.current) {
            abortUploadController.current.abort(); // Abort the current request if controller exists
        }
        axios.get(`${config.backend_api_url}/objects/abort-upload`, {})
            .then(response => {
                console.log('Upload aborted', response);
            })
            .catch(error => {
                console.error('Error aborting upload', error);
            });
        resetUploadPanel();
    }

    const [uploadedToS3Percentage, setUploadedToS3Percentage] = React.useState(-1);
    const [uploadedPercentage, setUploadedPercentage] = React.useState(-1);

    const handleUploadFileConfirm = (_event: React.MouseEvent) => {
        console.log('Uploading file', filename);
        const formData = new FormData();
        if (!fileUploadValue) {
            return;
        }
        formData.append('file', fileUploadValue);
        const fileSize = fileUploadValue.size;

        const encodedKey = btoa(decodedPrefix + filename);

        // Upload progress feedback
        const eventSource = new EventSource(`${config.backend_api_url}/objects/upload-progress`);
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.loaded !== 0 && data.status === 'uploading') {
                setUploadedToS3Percentage(Math.round((data.loaded / fileSize) * 100));
            } else {
                setUploadedToS3Percentage(-1);
            }
            if (data.status === 'completed') {
                eventSource.close();
                setUploadedToS3Percentage(-1);
            }
        }

        // Upload
        abortUploadController.current = new AbortController();
        axios.post(`${config.backend_api_url}/objects/upload/${bucketName}/${encodedKey}`, formData, {
            signal: abortUploadController.current.signal,
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                setUploadedPercentage(Math.round((progressEvent.loaded / fileSize) * 100));
            }
        })
            .then(response => {
                const oldFileName = filename;
                Emitter.emit('notification', { variant: 'success', title: 'File uploaded', description: 'File "' + oldFileName + '" has been successfully uploaded.' });
                resetUploadPanel();
                history.push(`/objects/${bucketName}/${btoa(decodedPrefix)}`);

            })
            .catch(error => {
                console.error('Error uploading file', error);
                Emitter.emit('notification', { variant: 'warning', title: 'File upload failed', description: String(error) });
                resetUploadPanel();
            });
    }

    const [fileUploadValue, setFileUploadValue] = React.useState<File | undefined>(undefined);
    const [filename, setFilename] = React.useState('');

    const handleFileInputChange = (_, file: File) => {
        setFilename(file.name);
        setFileUploadValue(file);
    };

    const handleClear = (_event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setFilename('');
        setFileUploadValue(undefined);
    };

    // Delete file handling
    const [isDeleteFileModalOpen, setIsDeleteFileModalOpen] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState('');
    const [fileToDelete, setFileToDelete] = React.useState('');

    const handleButtonDeleteFile = (key: string) => (_event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setSelectedFile(key);
        setIsDeleteFileModalOpen(true);
    }

    const validateFileToDelete = (): boolean => {
        if (fileToDelete !== selectedFile.split('/').pop()) {
            return false;
        } else {
            return true;
        }
    }

    const handleDeleteFileModalToggle = (_event: KeyboardEvent | React.MouseEvent) => {
        setIsDeleteFileModalOpen(!isDeleteFileModalOpen);
    }

    const handleDeleteFileConfirm = (_event: React.MouseEvent) => {
        if (!validateFileToDelete()) {
            alert('Invalid file to delete')
            return;
        }
        setIsDeleteFileModalOpen(false);
        axios.delete(`${config.backend_api_url}/objects/${bucketName}/${btoa(selectedFile)}`)
            .then(response => {
                Emitter.emit('notification', { variant: 'success', title: 'File deleted', description: 'File "' + selectedFile + '" has been successfully deleted.' });
                history.push(`/objects/${bucketName}/${btoa(decodedPrefix)}`);
                setFileToDelete('');
            })
            .catch(error => {
                console.error('Error deleting file', error);
                Emitter.emit('notification', { variant: 'warning', title: 'File deletion failed', description: String(error) });
            });
    }

    const handleDeleteFileCancel = (_event: React.MouseEvent) => {
        setFileToDelete('');
        setIsDeleteFileModalOpen(false);
    }

    // Create folder handling
    const [newFolderName, setNewFolderName] = React.useState('');
    const [newFolderNameRulesVisibility, setNewFolderNameRulesVisibility] = React.useState(false);
    const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = React.useState(false);
    const handleCreateFolderModalToggle = (_event: KeyboardEvent | React.MouseEvent) => {
        setIsCreateFolderModalOpen(!isCreateFolderModalOpen);
    }

    function validateFolderName(folderName: string): boolean {
        if (folderName === '') {
            return false;
        }
        const validCharacters = /^[a-zA-Z0-9!.-_*'()]+$/;
        if (!validCharacters.test(folderName)) {
            return false;
        }
        return true;
    }

    React.useEffect(() => {
        if (newFolderName.length > 0) {
            setNewFolderNameRulesVisibility(!validateFolderName(newFolderName));
        } else {
            setNewFolderNameRulesVisibility(false);
        }
    }, [newFolderName]);

    const handleNewFolderCreate = () => {
        if (!validateFolderName(newFolderName)) {
            alert('Invalid folder name');
            return;
        } else {
            const formData = new FormData();
            const emptyFile = new File([''], '.s3keep');
            formData.append('file', emptyFile);
            const encodedKey = btoa(decodedPrefix + newFolderName + '/.s3keep');
            axios.post(`${config.backend_api_url}/objects/upload/${bucketName}/${encodedKey}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })
                .then(response => {
                    const oldFolderName = newFolderName;
                    Emitter.emit('notification', { variant: 'success', title: 'Folder created', description: 'Folder "' + oldFolderName + '" has been successfully created.' });
                    setNewFolderName('');
                    history.push(`/objects/${bucketName}/${btoa(decodedPrefix + newFolderName + '/')}`);
                })
                .catch(error => {
                    console.error('Error creating folder', error);
                    Emitter.emit('notification', { variant: 'warning', title: 'Folder creation failed', description: String(error) });
                });
            setNewFolderName('');
            setIsCreateFolderModalOpen(false);
        }
    }

    const handleNewFolderCancel = () => {
        setNewFolderName('');
        setIsCreateFolderModalOpen(false);
    }

    // Import HF model handling
    const [modelName, setModelName] = React.useState('');
    const [isImportModelModalOpen, setIsImportModelModalOpen] = React.useState(false);
    const handleImportModelModalToggle = (_event: KeyboardEvent | React.MouseEvent) => {
        setIsImportModelModalOpen(!isImportModelModalOpen);
    }

    const handleImportModelCancel = (_event: React.MouseEvent) => {
        setIsImportModelModalOpen(false);
        setModelName('');
    }

    const handleImportModelConfirm = (_event: React.MouseEvent) => {
        console.log('Importing model', modelName);
        axios.get(`${config.backend_api_url}/objects/import/${bucketName}/${btoa(decodedPrefix)}/${btoa(modelName)}`)
            .then(response => {
                Emitter.emit('notification', { variant: 'success', title: 'Model imported', description: 'Model "' + modelName + '" has been successfully imported.' });
                history.push(`/objects/${bucketName}/${btoa(decodedPrefix)}`);
            })
            .catch(error => {
                console.error('Error cloning model', error);
                Emitter.emit('notification', { variant: 'warning', title: 'Model importing failed', description: String(error) });
            });
        setModelName('');
        setIsImportModelModalOpen(false);

    }
    return (
        <Page className='buckets-list'>
            <PageSection>
                <TextContent>
                    <Text component={TextVariants.h1}>Objects</Text>
                </TextContent>
            </PageSection>
            <PageSection>
                <Flex>
                    <FlexItem>
                        <Text component={TextVariants.h4}>
                            Browsing objects in bucket:
                        </Text>
                    </FlexItem>
                    <FlexItem>
                        <FormSelect className='bucket-select' value={formSelectBucket}
                            aria-label="FormSelect Input"
                            ouiaId="BasicFormSelect"
                            onChange={handleBucketChange}>
                            {bucketsList?.buckets.map(bucket => (
                                <FormSelectOption key={bucket.Name} value={bucket.Name} label={bucket.Name} />
                            ))}
                        </FormSelect>
                    </FlexItem>
                </Flex>
            </PageSection>
            <PageSection>
                <Flex direction={{ default: 'column' }}>
                    <FlexItem>
                        <Breadcrumb ouiaId="PrefixBreadcrumb">
                            <BreadcrumbItem
                                to={`/objects/${bucketName}`}>
                                <Button variant="link"
                                    className='breadcrumb-button'
                                    onClick={handlePrefixClick('')}
                                >
                                    {bucketName}
                                </Button>
                            </BreadcrumbItem>
                            {decodedPrefix.slice(0, -1).split('/').map((part, index) => (
                                <BreadcrumbItem
                                    key={index}
                                >
                                    <Button variant="link"
                                        className='breadcrumb-button'
                                        onClick={handlePrefixClick(decodedPrefix.slice(0, -1).split('/').slice(0, index + 1).join('/') + '/')}
                                        isDisabled={index === decodedPrefix.slice(0, -1).split('/').length - 1}
                                    >
                                        {part}
                                    </Button>
                                </BreadcrumbItem>
                            ))
                            }
                        </Breadcrumb>
                    </FlexItem>
                    <FlexItem>
                        <Flex>
                            <FlexItem>
                                <TextInput
                                    value={searchObjectText}
                                    type="search"
                                    onChange={(_event, searchText) => setSearchObjectText(searchText)}
                                    aria-label="search text input"
                                    placeholder="Filter objects..."
                                    customIcon={<SearchIcon />}
                                    className='buckets-list-filter-search'
                                />
                            </FlexItem>
                            <FlexItem align={{ default: 'alignRight' }}>
                                <Flex>
                                    <FlexItem className='file-folder-buttons'>
                                        <Button variant="primary" onClick={handleCreateFolderModalToggle} ouiaId="ShowCreateFolderModal">
                                            Create Folder</Button>
                                    </FlexItem>
                                    <FlexItem className='file-folder-buttons'>
                                        <Button variant="primary" onClick={handleUploadFileModalToggle} ouiaId="ShowUploadFileModal">
                                            Upload File</Button>
                                    </FlexItem>
                                    <FlexItem className='file-folder-buttons'>
                                        <Button variant="primary" onClick={handleImportModelModalToggle} ouiaId="ShowUploadFileModal">
                                            Import HF Model</Button>
                                    </FlexItem>
                                </Flex>
                            </FlexItem>
                        </Flex>
                    </FlexItem>
                    <FlexItem>
                        <Card component="div">
                            <Table aria-label="Buckets list" isStickyHeader>
                                <Thead>
                                    <Tr>
                                        <Th width={30}>{columnNames.key}</Th>
                                        <Th width={10}>{columnNames.lastModified}</Th>
                                        <Th width={10}>{columnNames.size}</Th>
                                        <Th width={10}>&nbsp;</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {filteredPrefixRows.map((row, rowIndex) => (
                                        <Tr key={rowIndex} className='bucket-row'>
                                            <Td className='bucket-column'>
                                                <Button variant="link" onClick={handlePrefixClick(row.prefix)} className='button-folder-link'>
                                                    <FontAwesomeIcon icon={faFolder} className='folder-icon' />
                                                    {row.prefix.slice(0, -1).split('/').pop()}
                                                </Button>
                                            </Td>
                                            <Td className='bucket-column'></Td>
                                            <Td className='bucket-column'></Td>
                                            <Td className='bucket-column align-right'></Td>
                                        </Tr>
                                    ))}
                                </Tbody>
                                <Tbody>
                                    {filteredRows.map((row, rowIndex) => (
                                        <Tr key={rowIndex} className='bucket-row'>
                                            <Td className='bucket-column'>
                                                <FontAwesomeIcon icon={faFile} className='file-icon' />
                                                {row.key.split('/').pop()}
                                            </Td>
                                            <Td className='bucket-column'>{row.lastModified}</Td>
                                            <Td className='bucket-column'>{row.size}</Td>
                                            <Td className='bucket-column align-right'>
                                                <ToolbarContent>
                                                    <ToolbarGroup
                                                        variant="icon-button-group"
                                                        align={{ default: 'alignRight' }}
                                                        spacer={{ default: 'spacerMd', md: 'spacerMd' }}
                                                    >
                                                        <ToolbarItem spacer={{ default: 'spacerLg' }}>
                                                            <Tooltip content={<div>View this file.</div>}>
                                                                <Button variant="primary" className='button-file-control'
                                                                    isDisabled={!validateFileView(row.key.split('/').pop() || '', row.originalSize)}
                                                                    onClick={handleObjectView(row.key)}>
                                                                    <FontAwesomeIcon icon={faEye} />
                                                                </Button>
                                                            </Tooltip>
                                                        </ToolbarItem>
                                                        <ToolbarItem spacer={{ default: 'spacerLg' }}>
                                                            <Tooltip content={<div>Download this file.</div>}>
                                                                <Button component="a" variant="primary" className='button-file-control'
                                                                    download={row.key.split('/').pop()}
                                                                    href={`${config.backend_api_url}/objects/download/${bucketName}/${btoa(row.key)}`}>
                                                                    <FontAwesomeIcon icon={faDownload} />
                                                                </Button>
                                                            </Tooltip>
                                                        </ToolbarItem>
                                                        <ToolbarItem variant='separator' />
                                                        <ToolbarItem>
                                                            <Tooltip content={<div>Delete this file.</div>}>
                                                                <Button variant="danger" className='button-file-control'
                                                                    onClick={handleButtonDeleteFile(row.key)}>
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </Button>
                                                            </Tooltip>
                                                        </ToolbarItem>
                                                    </ToolbarGroup>
                                                </ToolbarContent>
                                            </Td>
                                        </Tr>
                                    ))}
                                </Tbody>
                            </Table>

                        </Card>
                        <Flex direction={{ default: 'column' }} >
                            <FlexItem className='file-list-notes' align={{ default: 'alignRight' }}>
                                <Text component={TextVariants.small}>
                                    File viewer is only enabled for files smaller than 1MB and supported types.
                                </Text>
                            </FlexItem>
                            <FlexItem className='file-list-notes' align={{ default: 'alignRight' }}>
                                <Text component={TextVariants.small}>
                                    Deleting the last item in a folder will delete the folder.
                                </Text>
                            </FlexItem>
                            <FlexItem className='file-list-notes' align={{ default: 'alignRight' }}>
                                <Text component={TextVariants.small}>
                                    Download of large files may fail.
                                </Text>
                            </FlexItem>
                        </Flex>
                    </FlexItem>
                </Flex>
            </PageSection>
            <Modal
                title="File Preview"
                isOpen={isFileViewerOpen}
                onClose={handleFileViewerToggle}
                actions={[
                    <Button key="close" variant="primary" onClick={handleFileViewerToggle}>
                        Close
                    </Button>
                ]}
                ouiaId='file-viewer-modal'
                className='file-viewer-modal'
            >
                <DocumentRenderer fileData={fileData} fileName={fileName} />
            </Modal>
            <Modal
                title={"Upload file"}
                className="bucket-modal"
                isOpen={isUploadFileModalOpen}
                onClose={handleUploadFileModalToggle}
                actions={[
                    <Button key="confirm" variant="primary" onClick={handleUploadFileConfirm} isDisabled={filename === ""}>
                        Upload
                    </Button>,
                    <Button key="cancel" variant="link" onClick={handleUploadFileCancel}>
                        Cancel
                    </Button>
                ]}
            >
                <FileUpload
                    id="simple-file"
                    value={fileUploadValue}
                    filename={filename}
                    filenamePlaceholder="Drag and drop a file or upload one"
                    onFileInputChange={handleFileInputChange}
                    onClearClick={handleClear}
                    browseButtonText="Browse"
                />
                <Flex direction={{ default: 'column' }} className='upload-bars'>
                    <FlexItem hidden={(uploadedPercentage === -1)}>
                        <Progress value={uploadedPercentage} title="Upload to backend progress" size={ProgressSize.sm} />
                    </FlexItem>
                    <FlexItem hidden={(uploadedToS3Percentage === -1)}>
                        <Progress value={uploadedToS3Percentage} title="Upload to S3 progress" size={ProgressSize.sm} />
                    </FlexItem>
                </Flex>
            </Modal>
            <Modal
                title={"Delete " + selectedFile.split('/').pop()}
                className="bucket-modal"
                isOpen={isDeleteFileModalOpen}
                onClose={handleDeleteFileModalToggle}
                actions={[
                    <Button key="confirm" variant='danger' onClick={handleDeleteFileConfirm} isDisabled={!validateFileToDelete()}>
                        Confirm deletion
                    </Button>,
                    <Button key="cancel" variant="link" onClick={handleDeleteFileCancel}>
                        Cancel
                    </Button>
                ]}
            >
                <TextContent>
                    <Text component={TextVariants.small}>
                        You are about to delete the file "{selectedFile.split('/').pop()}". Please enter the name of the file to confirm deletion.
                    </Text>
                </TextContent>
                <Form>
                    <FormGroup
                        label="Bucket name"
                        isRequired
                        fieldId="bucket-name"
                    >
                        <TextInput
                            isRequired
                            type="text"
                            id="bucket-name"
                            name="bucket-name"
                            aria-describedby="bucket-name-helper"
                            value={fileToDelete}
                            onChange={(_event, fileToDelete) => setFileToDelete(fileToDelete)}
                        />
                    </FormGroup>
                </Form>
            </Modal>
            <Modal
                title="Create a new bucket"
                className="bucket-modal"
                isOpen={isCreateFolderModalOpen}
                onClose={handleCreateFolderModalToggle}
                actions={[
                    <Button key="create" variant="primary" onClick={handleNewFolderCreate} isDisabled={(newFolderName.length < 1) || newFolderNameRulesVisibility}>
                        Create
                    </Button>,
                    <Button key="cancel" variant="link" onClick={handleNewFolderCancel}>
                        Cancel
                    </Button>
                ]}
                ouiaId="CreateFolderModal"
            >
                <Form>
                    <FormGroup
                        label="Folder name"
                        isRequired
                        fieldId="folder-name"
                    >
                        <TextInput
                            isRequired
                            type="text"
                            id="folder-name"
                            name="folder-name"
                            aria-describedby="folder-name-helper"
                            placeholder='Enter at least 1 character'
                            value={newFolderName}
                            onChange={(_event, newFolderName) => setNewFolderName(newFolderName)}
                        />
                    </FormGroup>
                </Form>
                <TextContent hidden={!newFolderNameRulesVisibility}>
                    <Text component={TextVariants.small} className="bucket-name-rules">
                        Folder names must:
                        <ul>
                            <li>be unique,</li>
                            <li>only contain lowercase letters, numbers and hyphens,</li>
                        </ul>
                    </Text>
                </TextContent>
            </Modal>
            <Modal
                title="Import a model from Hugging Face"
                className="bucket-modal"
                isOpen={isImportModelModalOpen}
                onClose={handleImportModelModalToggle}
                actions={[
                    <Button key="import" variant="primary" onClick={handleImportModelConfirm} isDisabled={(modelName.length < 1)}>
                        Import
                    </Button>,
                    <Button key="cancel" variant="link" onClick={handleImportModelCancel}>
                        Cancel
                    </Button>
                ]}
                ouiaId="ImportModelModal"
            >
                <Form>
                    <FormGroup
                        label="Model name"
                        isRequired
                        fieldId="model-name"
                    >
                        <TextInput
                            isRequired
                            type="text"
                            id="model-name"
                            name="model-name"
                            aria-describedby="model-name-helper"
                            placeholder='Enter at least 1 character'
                            value={modelName}
                            onChange={(_event, modelName) => setModelName(modelName)}
                        />
                    </FormGroup>
                </Form>
            </Modal>
        </Page>
    );
};

export default ObjectBrowser;