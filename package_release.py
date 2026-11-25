"""Package the built Windows application for GitHub Releases."""
import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def package_release(output: Path, version: str) -> Path:
    application = output / 'KinEver'
    executable = application / 'KinEver.exe'
    if not executable.is_file() or not (application / '_internal/dist/index.html').is_file():
        raise ValueError('Build the Windows executable and frontend first.')

    readme = Path(__file__).with_name('README.md')
    (application / 'README.md').write_bytes(readme.read_bytes())
    archive = output.parent / f'KinEver-{version}-win-x64.zip'
    temporary = archive.with_suffix('.tmp')
    private_extensions = {'.db', '.sqlite', '.sqlite3', '.ged', '.gedcom', '.gdz', '.gedzip'}
    with ZipFile(temporary, 'w', ZIP_DEFLATED) as bundle:
        for path in sorted(application.rglob('*')):
            if not path.is_file():
                continue
            if path.suffix.lower() in private_extensions:
                raise ValueError(f'Unexpected data file in release bundle: {path}')
            bundle.write(path, path.relative_to(output))
    with ZipFile(temporary) as bundle:
        bad_entry = bundle.testzip()
        if bad_entry:
            raise ValueError(f'Invalid archive entry: {bad_entry}')
    temporary.replace(archive)
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('version')
    args = parser.parse_args()
    print(package_release(args.output, args.version).resolve())
