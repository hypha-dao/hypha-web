import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getDaos, type Dao, getProposalsForDao } from './services/eos';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface DaoOption {
  value: string;
  label: string;
}

interface Attachment {
  proposalId: string;
  title: string;
  cid: string;
}

const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

function App() {
  const [selectedDao, setSelectedDao] = useState<DaoOption | null>(null);
  const [daos, setDaos] = useState<Dao[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [proposalCount, setProposalCount] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    const fetchDaos = async () => {
      setLoading(true);
      const fetchedDaos = await getDaos();
      setDaos(fetchedDaos);
      setLoading(false);
    };

    fetchDaos();
  }, []);

  const handleDownload = async () => {
    if (!selectedDao) return;

    setDownloading(true);
    setProposalCount(0);
    setBatchCount(0);
    setAttachments([]);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      const proposals = await getProposalsForDao(
        selectedDao.value,
        (progress: {
          proposals: number;
          batches: number;
          totalBatches: number;
        }) => {
          setProposalCount(progress.proposals);
          setBatchCount(progress.batches);
          setTotalBatches(progress.totalBatches);
        },
        signal,
      );

      if (signal.aborted) {
        console.log('Download was aborted.');
        return;
      }

      const foundAttachments: Attachment[] = [];
      proposals.forEach((proposal: any) => {
        if (proposal.content_groups) {
          let title = 'Untitled';
          let url: string | null = null;
          proposal.content_groups.forEach((group: any) => {
            group.forEach((item: any) => {
              if (item.label === 'title') {
                title = item.value[1];
              }
              if (
                item.label === 'url' &&
                typeof item.value[1] === 'string' &&
                item.value[1].includes(':') &&
                item.value[1].startsWith('Qm')
              ) {
                url = item.value[1];
              }
            });
          });
          if (url) {
            foundAttachments.push({
              proposalId: proposal.id,
              title: decodeHtmlEntities(title),
              cid: url.split(':')[0],
            });
          }
        }
      });
      setAttachments(foundAttachments);

      const doc = new jsPDF() as jsPDFWithAutoTable;

      const tableData = proposals.map((proposal: any) => {
        let title = 'Untitled';
        let type = 'N/A';
        let description = 'No description';
        let payout = 'N/A';
        let asset = 'N/A';

        if (proposal.content_groups) {
          proposal.content_groups.forEach((group: any) => {
            group.forEach((item: any) => {
              if (item.label === 'title') title = item.value[1];
              if (item.label === 'type') type = item.value[1];
              if (item.label === 'description') description = item.value[1];
              if (item.label === 'payout') payout = item.value[1];
              if (item.label === 'asset') asset = item.value[1];
            });
          });
        }

        const decodedTitle = decodeHtmlEntities(title);
        const decodedDescription = decodeHtmlEntities(description);
        const payoutInfo =
          payout !== 'N/A' ? `\nPayout: ${payout}\nAsset: ${asset}` : '';

        return [
          proposal.id,
          decodedTitle,
          type,
          proposal.created_date,
          `${decodedDescription}${payoutInfo}`,
        ];
      });

      doc.autoTable({
        head: [['ID', 'Title', 'Type', 'Date', 'Description']],
        body: tableData,
        styles: { font: 'Arial' },
      });

      const daoName = selectedDao.label || 'dao';
      doc.save(`${daoName}-proposals.pdf`);
    } catch (error) {
      console.error('An error occurred during download:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const daoOptions: DaoOption[] = daos.map((dao) => ({
    value: dao.id,
    label: dao.name,
  }));

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      background: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
    }),
    menu: (base: any) => ({
      ...base,
      background: 'hsl(var(--card))',
    }),
    option: (base: any, state: any) => ({
      ...base,
      background: state.isFocused ? 'hsl(var(--accent-9))' : 'hsl(var(--card))',
      color: 'hsl(var(--foreground))',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'hsl(var(--foreground))',
    }),
    input: (base: any) => ({
      ...base,
      color: 'hsl(var(--foreground))',
    }),
  };

  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--page-background))',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'hsl(var(--foreground))',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '500px',
          width: '100%',
          padding: '2.5rem',
        }}
      >
        <h1
          className="text-8 font-bold font-heading"
          style={{ marginBottom: 'var(--spacing-2)', whiteSpace: 'nowrap' }}
        >
          Hypha v2 Proposal Downloader
        </h1>
        <p
          className="text-4"
          style={{
            color: 'hsl(var(--neutral-9))',
            marginTop: 0,
            marginBottom: 'var(--spacing-8)',
          }}
        >
          Select a DAO to download its proposals in PDF format, and display any
          proposal attachments on the screen.
        </p>

        <div style={{ marginBottom: 'var(--spacing-5)', width: '100%' }}>
          <Select
            options={daoOptions}
            onChange={setSelectedDao}
            isLoading={loading}
            placeholder={loading ? 'Loading DAOs...' : 'Search for a DAO...'}
            isClearable
            isSearchable
            styles={selectStyles}
            isDisabled={downloading}
          />
        </div>

        {!downloading ? (
          <button
            onClick={handleDownload}
            disabled={!selectedDao}
            style={{
              width: '100%',
              padding: 'var(--spacing-3) var(--spacing-4)',
              fontSize: 'var(--font-size-3)',
              fontWeight: 'var(--font-weight-medium)',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'hsl(var(--accent-9))',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Download
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              width: '100%',
              padding: 'var(--spacing-3) var(--spacing-4)',
              fontSize: 'var(--font-size-3)',
              fontWeight: 'var(--font-weight-medium)',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'hsl(var(--error-9))',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Stop
          </button>
        )}
        {attachments.length > 0 && !downloading && (
          <div style={{ marginTop: 'var(--spacing-6)' }}>
            <h2 className="text-5 font-bold">Proposal Attachments</h2>
            <table
              style={{
                width: '100%',
                marginTop: 'var(--spacing-4)',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      border: '1px solid hsl(var(--border))',
                      padding: 'var(--spacing-3)',
                      textAlign: 'left',
                    }}
                  >
                    Proposal ID
                  </th>
                  <th
                    style={{
                      border: '1px solid hsl(var(--border))',
                      padding: 'var(--spacing-3)',
                      textAlign: 'left',
                    }}
                  >
                    Title
                  </th>
                  <th
                    style={{
                      border: '1px solid hsl(var(--border))',
                      padding: 'var(--spacing-3)',
                      textAlign: 'left',
                    }}
                  >
                    Attachment Link
                  </th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((attachment, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        border: '1px solid hsl(var(--border))',
                        padding: 'var(--spacing-3)',
                        textAlign: 'left',
                      }}
                    >
                      {attachment.proposalId}
                    </td>
                    <td
                      style={{
                        border: '1px solid hsl(var(--border))',
                        padding: 'var(--spacing-3)',
                        textAlign: 'left',
                      }}
                    >
                      {attachment.title}
                    </td>
                    <td
                      style={{
                        border: '1px solid hsl(var(--border))',
                        padding: 'var(--spacing-3)',
                        textAlign: 'left',
                      }}
                    >
                      <a
                        href={`https://hypha.infura-ipfs.io/ipfs/${attachment.cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'hsl(var(--accent-11))' }}
                      >
                        {attachment.cid}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {downloading && (
          <>
            <p
              className="text-3"
              style={{
                marginTop: 'var(--spacing-4)',
                color: 'hsl(var(--neutral-9))',
              }}
            >
              It will take aprox. 2 minutes, you can come back later.
            </p>
            <div
              style={{
                marginTop: 'var(--spacing-4)',
                display: 'flex',
                gap: 'var(--spacing-4)',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  background: 'hsl(var(--card))',
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  flex: 1,
                }}
              >
                <p
                  className="text-3"
                  style={{ margin: 0, color: 'hsl(var(--neutral-9))' }}
                >
                  Proposals found
                </p>
                <p
                  className="text-5 font-bold"
                  style={{ margin: 'var(--spacing-1) 0 0' }}
                >
                  {proposalCount}
                </p>
              </div>
              <div
                style={{
                  background: 'hsl(var(--card))',
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  flex: 1,
                }}
              >
                <p
                  className="text-3"
                  style={{ margin: 0, color: 'hsl(var(--neutral-9))' }}
                >
                  Batches processed
                </p>
                <p
                  className="text-5 font-bold"
                  style={{ margin: 'var(--spacing-1) 0 0' }}
                >
                  {batchCount} / {totalBatches}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
